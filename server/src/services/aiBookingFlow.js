import { findAiSlots, listAiMasters, listAiServices } from './aiCatalogService.js';
import { parseRequestedDate } from './aiDemoEngine.js';
import { addDays, formatDate, parseDateParam } from '../utils/datetime.js';

const normalize = (value) => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const DATE_RE = /(сегодня|завтра|послезавтра|понедель|вторник|сред|четверг|пятниц|суббот|воскрес|\b20\d{2}-\d{2}-\d{2}\b)/i;
const GREETING_RE = /^(привет|здравствуй(?:те)?|добрый\s+(?:день|вечер|утро)|салам|hello|hi)[!.\s]*$/i;
const TIME_RE = /\b([01]?\d|2[0-3])[\s:.]([0-5]\d)\b/;
const PROMPT_INJECTION_RE = /игнорир(?:уй|овать)\s+(?:все\s+)?(?:правил|инструкц)|системн(?:ый|ые)\s+(?:промпт|инструкц)|developer\s+message|system\s+prompt|несуществующ(?:ий|его|ую)\s+(?:мастер|услуг|слот)/i;

function findMention(items, text) {
  const value = normalize(text);
  return [...items].sort((a, b) => b.name.length - a.name.length).find((item) => {
    const name = normalize(item.name);
    if (value.includes(name)) return true;
    const words = name.match(/[a-zа-я0-9]+/gi) || [];
    return words.length > 0 && words.every((word) => value.includes(word.slice(0, Math.min(5, word.length))));
  });
}

function serviceActions(services) {
  return services.map((service) => ({
    type: 'reply', label: service.name, message: service.name,
    selection: { serviceId: service.id, serviceName: service.name, masterId: null, masterName: null },
  }));
}

function masterActions(masters) {
  return masters.map((master) => ({
    type: 'reply', label: master.name, message: master.name,
    selection: { masterId: master.id, masterName: master.name },
  }));
}

function slotActions(slots, service, master) {
  return slots.map((slot) => ({
    type: 'booking_slot',
    label: new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.startsAt)),
    booking: { serviceId: service.id, serviceName: service.name, masterId: master.id, masterName: master.name, startsAt: slot.startsAt },
  }));
}

function filterTimePreference(slots, text) {
  const value = normalize(text);
  let filtered = slots;
  const hourOf = (slot) => Number(String(slot.startsAt).slice(11, 13));
  if (/утр/.test(value)) filtered = filtered.filter((slot) => hourOf(slot) < 12);
  else if (/вечер/.test(value)) filtered = filtered.filter((slot) => hourOf(slot) >= 17);
  else if (/дн[её]м|дня/.test(value)) filtered = filtered.filter((slot) => hourOf(slot) >= 12 && hourOf(slot) < 17);
  const after = value.match(/после\s+(\d{1,2})(?::(\d{2}))?/);
  if (after) {
    const threshold = Number(after[1]) * 60 + Number(after[2] || 0);
    filtered = filtered.filter((slot) => hourOf(slot) * 60 + Number(String(slot.startsAt).slice(14, 16)) >= threshold);
  }
  return filtered;
}

async function cleanContext(input, services) {
  const service = services.find((item) => item.id === Number(input?.serviceId));
  if (!service) return { service: null, master: null, date: input?.date || null };
  const masters = await listAiMasters(service.id);
  const master = masters.find((item) => item.id === Number(input?.masterId)) || null;
  return { service, masters, master, date: input?.date || null };
}

export async function resolveVerifiedBookingTurn({ messages = [], context: rawContext = {} }) {
  const services = await listAiServices();
  const latest = messages.filter((item) => item.role === 'user').at(-1)?.content || '';
  const normalized = normalize(latest);
  let { service, masters = [], master, date } = await cleanContext(rawContext, services);

  if (PROMPT_INJECTION_RE.test(latest)) {
    const nextStep = !service ? 'выбрать услугу' : (!master ? 'выбрать мастера' : (!date ? 'указать дату' : 'выбрать время из реально доступных вариантов'));
    return {
      message: `Я могу помочь только с информацией о салоне и записью. Сейчас можно ${nextStep}.`,
      actions: [{ type: 'reply', label: 'Продолжить запись', message: 'Продолжить подбор', selection: {} }],
      context: { serviceId: service?.id || null, serviceName: service?.name || null, masterId: master?.id || null, masterName: master?.name || null, date: date || null },
      toolsUsed: [],
    };
  }

  if (/начать\s+заново|начать\s+сначала|сбросить|новая\s+запись/.test(normalized)) {
    const lines = services.map((item) => `${item.name} — ${(item.priceCents / 100).toLocaleString('ru-RU')} ₸ · ${item.durationMinutes} мин.`).join('\n');
    return { message: `Начнём заново. Доступные услуги:\n\n${lines}\n\nКакую услугу вы хотите выбрать?`, actions: serviceActions(services), context: { serviceId: null, serviceName: null, masterId: null, masterName: null, date: null }, toolsUsed: ['list_services'] };
  }

  if (/друг(?:ая|ую|ой)\s+услуг|сменить\s+услуг/.test(normalized)) {
    return { message: 'Выберите другую услугу.', actions: serviceActions(services), context: { serviceId: null, serviceName: null, masterId: null, masterName: null, date: date || null }, toolsUsed: ['list_services'] };
  }

  if (service && /друг(?:ой|ого)\s+мастер|сменить\s+мастер/.test(normalized)) {
    const available = await listAiMasters(service.id);
    return { message: `Выберите другого мастера для услуги «${service.name}».`, actions: masterActions(available), context: { serviceId: service.id, serviceName: service.name, masterId: null, masterName: null, date: date || null }, toolsUsed: ['list_masters'] };
  }

  if (master && /друг(?:ой|ую)\s+(?:день|дат)|сменить\s+дат/.test(normalized)) {
    return { message: 'На какой день посмотреть свободное время?', actions: [{ type: 'reply', label: 'Сегодня', message: 'Сегодня', selection: {} }, { type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} }, { type: 'reply', label: 'Послезавтра', message: 'Послезавтра', selection: {} }], context: { serviceId: service.id, serviceName: service.name, masterId: master.id, masterName: master.name, date: null }, toolsUsed: [] };
  }
  const mentionedService = findMention(services, latest);
  if (mentionedService && mentionedService.id !== service?.id) {
    service = mentionedService;
    masters = await listAiMasters(service.id);
    master = null;
  }
  if (DATE_RE.test(latest)) date = parseRequestedDate(latest);

  if (date) {
    const parsedDate = parseDateParam(date);
    const today = parseRequestedDate('сегодня');
    const maxDate = formatDate(addDays(parseDateParam(today), 60));
    if (!parsedDate) {
      return { message: 'Такой даты не существует. Укажите дату в формате ГГГГ-ММ-ДД или выберите ближайший день.', actions: [{ type: 'reply', label: 'Сегодня', message: 'Сегодня', selection: {} }, { type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} }], context: { serviceId: service?.id || null, serviceName: service?.name || null, masterId: master?.id || null, masterName: master?.name || null, date: null }, toolsUsed: [] };
    }
    if (date < today) {
      return { message: 'Нельзя записаться на прошедшую дату. Выберите сегодня или более поздний день.', actions: [{ type: 'reply', label: 'Сегодня', message: 'Сегодня', selection: {} }, { type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} }], context: { serviceId: service?.id || null, serviceName: service?.name || null, masterId: master?.id || null, masterName: master?.name || null, date: null }, toolsUsed: [] };
    }
    if (date > maxDate) {
      return { message: 'Онлайн-запись доступна не более чем на 60 дней вперёд. Выберите более близкую дату.', actions: [{ type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} }, { type: 'reply', label: 'Послезавтра', message: 'Послезавтра', selection: {} }], context: { serviceId: service?.id || null, serviceName: service?.name || null, masterId: master?.id || null, masterName: master?.name || null, date: null }, toolsUsed: [] };
    }
  }

  const hasActiveContext = Boolean(service || master || date);
  if (hasActiveContext && GREETING_RE.test(latest)) {
    const step = !service ? 'выборе услуги' : (!master ? `выборе мастера для услуги «${service.name}»` : (!date ? `выборе даты для мастера «${master.name}»` : `выборе времени для мастера «${master.name}»`));
    return { message: `Здравствуйте! Мы остановились на ${step}. Можем продолжить или начать подбор заново.`, actions: [{ type: 'reply', label: 'Продолжить', message: 'Продолжить подбор', selection: {} }, { type: 'reply', label: 'Начать заново', message: 'Покажи услуги', selection: { serviceId: null, serviceName: null, masterId: null, masterName: null, date: null } }], context: rawContext, toolsUsed: [] };
  }

  const wantsCatalog = /услуг|цен|стоим|прайс|что есть/.test(normalized);
  const structuralIntent = /запис|свобод|окош|врем|слот|продолж|посовет|рекоменд|лучший/.test(normalized)
    || Boolean(mentionedService || DATE_RE.test(latest) || TIME_RE.test(latest));
  if (hasActiveContext && !wantsCatalog && !structuralIntent) {
    if (service && !master && masters.length) {
      return {
        message: `Не нашёл такого мастера для услуги «${service.name}». Доступны: ${masters.map((item) => item.name).join(', ')}.`,
        actions: masterActions(masters),
        context: { serviceId: service.id, serviceName: service.name, masterId: null, masterName: null, date: date || null },
        toolsUsed: ['list_masters'],
      };
    }
    const nextStep = !service ? 'выбрать услугу' : (!master ? 'выбрать мастера' : (!date ? 'указать дату' : 'выбрать свободное время'));
    return {
      message: `Не совсем понял вопрос. Сейчас нужно ${nextStep}. Уточните запрос или продолжите подбор.`,
      actions: [{ type: 'reply', label: 'Продолжить подбор', message: 'Продолжить подбор', selection: {} }],
      context: { serviceId: service?.id || null, serviceName: service?.name || null, masterId: master?.id || null, masterName: master?.name || null, date: date || null },
      toolsUsed: [],
    };
  }
  const bookingIntent = structuralIntent || Boolean(!latest && hasActiveContext);
  if (!wantsCatalog && !bookingIntent) return null;

  const context = {
    serviceId: service?.id || null, serviceName: service?.name || null,
    masterId: master?.id || null, masterName: master?.name || null, date: date || null,
  };

  if (!service) {
    const lines = services.map((item) => `${item.name} — ${(item.priceCents / 100).toLocaleString('ru-RU')} ₸ · ${item.durationMinutes} мин.`).join('\n');
    return { message: `Доступные услуги:\n\n${lines}\n\nКакую услугу вы хотите выбрать?`, actions: serviceActions(services), context, toolsUsed: ['list_services'] };
  }

  masters = await listAiMasters(service.id);
  const mentionedMaster = findMention(masters, latest);
  if (mentionedMaster) master = mentionedMaster;
  if (master && !masters.some((item) => item.id === master.id)) master = null;
  context.masterId = master?.id || null;
  context.masterName = master?.name || null;

  if (!masters.length) {
    return { message: `Для услуги «${service.name}» сейчас нет доступных мастеров. Выберите другую услугу.`, actions: serviceActions(services.filter((item) => item.id !== service.id)), context, toolsUsed: ['list_masters'] };
  }

  if (!master) {
    if (/посовет|рекоменд|лучший/.test(normalized)) {
      const bestRating = Math.max(...masters.map((item) => Number(item.rating) || 0));
      const recommended = masters.filter((item) => Number(item.rating) === bestRating);
      const recommendation = recommended.length === 1
        ? `По рейтингу могу рекомендовать мастера «${recommended[0].name}» — ${bestRating.toFixed(1)} ⭐.`
        : `У мастеров ${recommended.map((item) => item.name).join(', ')} одинаковый рейтинг ${bestRating.toFixed(1)} ⭐. Можно выбрать любого или ориентироваться на удобное время.`;
      return { message: recommendation, actions: masterActions(masters), context, toolsUsed: ['list_masters'] };
    }
    return {
      message: `Для услуги «${service.name}» доступны: ${masters.map((item) => item.name).join(', ')}. Выберите мастера.`,
      actions: masterActions(masters), context, toolsUsed: ['list_masters'],
    };
  }

  if (!date) {
    return {
      message: `Вы выбрали мастера «${master.name}». На какой день подобрать свободное время?`,
      actions: [
        { type: 'reply', label: 'Сегодня', message: 'Сегодня', selection: {} },
        { type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} },
        { type: 'reply', label: 'Послезавтра', message: 'Послезавтра', selection: {} },
      ], context, toolsUsed: [],
    };
  }

  const found = await findAiSlots({ serviceId: service.id, masterId: master.id, dateFrom: date, dateTo: date, limit: 48 });
  const requestedTime = normalized.match(TIME_RE);
  if (requestedTime) {
    const time = `${String(Number(requestedTime[1])).padStart(2, '0')}:${requestedTime[2]}`;
    const exact = found.find((slot) => String(slot.startsAt).slice(11, 16) === time);
    if (exact) {
      return {
        message: `${time} свободно. Проверьте детали и подтвердите запись.`,
        actions: slotActions([exact], service, master), context, toolsUsed: ['find_available_slots'],
      };
    }
    const requestedMinutes = Number(requestedTime[1]) * 60 + Number(requestedTime[2]);
    const nearest = [...found].sort((a, b) => {
      const minutes = (slot) => Number(String(slot.startsAt).slice(11, 13)) * 60 + Number(String(slot.startsAt).slice(14, 16));
      return Math.abs(minutes(a) - requestedMinutes) - Math.abs(minutes(b) - requestedMinutes);
    }).slice(0, 4).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
    return {
      message: nearest.length
        ? `${time} недоступно. Ближайшие свободные варианты:`
        : `На выбранную дату у мастера «${master.name}» свободного времени нет.`,
      actions: slotActions(nearest, service, master), context, toolsUsed: ['find_available_slots'],
    };
  }

  const slots = filterTimePreference(found, latest).slice(0, 8);
  if (!slots.length) {
    const today = parseRequestedDate('сегодня');
    const reason = date === today ? 'На сегодня свободного времени уже нет.' : `На выбранную дату у ${master.name} свободного времени нет.`;
    return {
      message: `${reason} Выберите другой день.`,
      actions: [{ type: 'reply', label: 'Завтра', message: 'Завтра', selection: {} }, { type: 'reply', label: 'Послезавтра', message: 'Послезавтра', selection: {} }],
      context, toolsUsed: ['find_available_slots'],
    };
  }

  return {
      message: `Свободное время у мастера «${master.name}» на выбранную дату. Выберите подходящий слот:`,
    actions: slotActions(slots, service, master), context, toolsUsed: ['find_available_slots'],
  };
}
