import { findAiSlots, listAiMasters, listAiServices, toDateString } from './aiCatalogService.js';

const normalize = (value) => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const GREETING_RE = /^(привет|здравствуй(?:те)?|добрый\s+(?:день|вечер|утро)|салам|hello|hi)[!.\s]*$/i;
const THANKS_RE = /^(спасибо|благодарю|понял(?:а)?|хорошо|ок(?:ей)?)[!.\s]*$/i;
const DATE_RE = /(сегодня|завтра|послезавтра|понедель|вторник|сред|четверг|пятниц|суббот|воскрес|\b20\d{2}-\d{2}-\d{2}\b)/i;

export function parseRequestedDate(text, now = new Date()) {
  const normalized = normalize(text);
  const explicit = normalized.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (explicit) return explicit[0];
  const result = new Date(now);
  if (/послезавтра/.test(normalized)) result.setDate(result.getDate() + 2);
  else if (/завтра/.test(normalized)) result.setDate(result.getDate() + 1);
  const weekdays = [['воскрес', 0], ['понедель', 1], ['вторник', 2], ['сред', 3], ['четверг', 4], ['пятниц', 5], ['суббот', 6]];
  const requestedDay = weekdays.find(([name]) => normalized.includes(name));
  if (requestedDay) {
    let offset = (requestedDay[1] - result.getDay() + 7) % 7;
    if (offset === 0 && !/сегодня/.test(normalized)) offset = 7;
    result.setDate(result.getDate() + offset);
  }
  return toDateString(result);
}

function replyActions(items, messageFactory) {
  return items.map((item) => ({ type: 'reply', label: item.name, message: messageFactory(item), value: item }));
}

function findMention(items, text) {
  const normalizedText = normalize(text);
  return [...items]
    .sort((a, b) => normalize(b.name).length - normalize(a.name).length)
    .find((item) => {
      const name = normalize(item.name);
      if (normalizedText.includes(name)) return true;
      const words = name.match(/[a-zа-я0-9]+/gi) || [];
      return words.length > 0 && words.every((word) => normalizedText.includes(word.slice(0, Math.min(5, word.length))));
    });
}

function latestUserSelection(items, userMessages) {
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const match = findMention(items, userMessages[index].content);
    if (match) return match;
  }
  return null;
}

function catalogReply(services, prefix = 'Сейчас доступны') {
  const priceText = services.map((service) => `${service.name} — ${(service.priceCents / 100).toLocaleString('ru-RU')} ₸, ${service.durationMinutes} мин.`).join('\n');
  return {
    message: `${prefix}:\n\n${priceText}\n\nКакая услуга вас интересует?`,
    actions: replyActions(services, (service) => service.name),
    toolsUsed: ['list_services'],
  };
}

export async function runDemoAssistant({ messages = [], now = new Date(), catalog = {} } = {}) {
  const services = catalog.services || await listAiServices();
  const userMessages = messages.filter((item) => item.role === 'user');
  const latest = userMessages.at(-1)?.content || '';
  const normalizedLatest = normalize(latest);
  const latestService = findMention(services, latest);
  const selectedService = latestService || latestUserSelection(services, userMessages);

  if (GREETING_RE.test(latest) && !latestService) {
    return {
      message: selectedService
        ? `Здравствуйте! Мы выбирали услугу «${selectedService.name}». Можем продолжить запись или выбрать другую услугу.`
        : 'Здравствуйте! Я помогу узнать цены и подобрать услугу, подходящего мастера и свободное время.',
      actions: selectedService
        ? [{ type: 'reply', label: 'Продолжить запись', message: `Продолжим запись на ${selectedService.name}` }, { type: 'reply', label: 'Другие услуги', message: 'Покажи другие услуги' }]
        : [{ type: 'reply', label: 'Услуги и цены', message: 'Покажи услуги и цены' }, { type: 'reply', label: 'Записаться', message: 'Хочу записаться' }],
      toolsUsed: selectedService ? ['list_services'] : [],
    };
  }

  if (THANKS_RE.test(latest)) {
    return { message: 'Пожалуйста! Если захотите записаться или уточнить цену — я рядом.', actions: [{ type: 'reply', label: 'Записаться', message: 'Хочу записаться' }], toolsUsed: [] };
  }

  if (/услуг|цен|стоим|прайс|что есть|другие/.test(normalizedLatest) || (!selectedService && /запис/.test(normalizedLatest))) {
    return catalogReply(services, 'Я помогу подобрать услугу. Сейчас доступны');
  }

  if (!selectedService) {
    return catalogReply(services, 'Я пока не понял, какая услуга вам нужна. Вот что можно выбрать');
  }

  const masters = catalog.masters || await listAiMasters(selectedService.id);
  const latestMaster = findMention(masters, latest);
  const selectedMaster = latestMaster || latestUserSelection(masters, userMessages);
  const hasDate = userMessages.some((message) => DATE_RE.test(message.content));
  const latestHasUsefulChoice = Boolean(latestService || latestMaster || DATE_RE.test(latest));

  if (!masters.length) {
    return { message: `Для услуги «${selectedService.name}» сейчас нет доступных мастеров. Пожалуйста, выберите другую услугу.`, actions: replyActions(services.filter((item) => item.id !== selectedService.id), (service) => service.name), toolsUsed: ['list_services', 'list_masters'] };
  }

  if (!selectedMaster && masters.length > 1) {
    if (!latestService && !latestMaster) {
      return {
        message: `Я не совсем понял сообщение. Для услуги «${selectedService.name}» сейчас нужно выбрать мастера. Нажмите на имя ниже или напишите, кого предпочитаете.`,
        actions: replyActions(masters, (master) => master.name),
        toolsUsed: ['list_services', 'list_masters'],
      };
    }
    return {
      message: `Услугу «${selectedService.name}» выполняют: ${masters.map((master) => `${master.name} (${Number(master.rating).toFixed(1)} ⭐)`).join(', ')}. Выберите мастера.`,
      actions: replyActions(masters, (master) => master.name),
      toolsUsed: ['list_services', 'list_masters'],
    };
  }

  const master = selectedMaster || masters[0];
  if (!hasDate) {
    if (!latestService && !latestMaster && !DATE_RE.test(latest)) {
      return {
        message: `Я не совсем понял сообщение. Мастер ${master.name} выбран для услуги «${selectedService.name}». Теперь укажите день записи.`,
        actions: [
          { type: 'reply', label: 'Сегодня', message: `Хочу ${selectedService.name} у ${master.name} сегодня` },
          { type: 'reply', label: 'Завтра', message: `Хочу ${selectedService.name} у ${master.name} завтра` },
        ],
        toolsUsed: ['list_services', 'list_masters'],
      };
    }
    return {
      message: `${masters.length === 1 ? `Эту услугу выполняет ${master.name}. ` : ''}На какой день подобрать свободное время?`,
      actions: [
        { type: 'reply', label: 'Сегодня', message: `Хочу ${selectedService.name} у ${master.name} сегодня` },
        { type: 'reply', label: 'Завтра', message: `Хочу ${selectedService.name} у ${master.name} завтра` },
        { type: 'reply', label: 'Послезавтра', message: `Хочу ${selectedService.name} у ${master.name} послезавтра` },
      ],
      toolsUsed: ['list_services', 'list_masters'],
    };
  }

  if (!latestHasUsefulChoice) {
    return {
      message: `Я не совсем понял сообщение. Мы подбираем время для услуги «${selectedService.name}» у мастера ${master.name}. Напишите новую дату или выберите действие ниже.`,
      actions: [{ type: 'reply', label: 'Посмотреть завтра', message: `Хочу ${selectedService.name} у ${master.name} завтра` }, { type: 'reply', label: 'Начать заново', message: 'Покажи другие услуги' }],
      toolsUsed: ['list_services', 'list_masters'],
    };
  }

  const dateMessage = [...userMessages].reverse().find((message) => DATE_RE.test(message.content));
  const requestedDate = parseRequestedDate(dateMessage?.content || latest, now);
  const slots = catalog.slots || await findAiSlots({ serviceId: selectedService.id, masterId: master.id, dateFrom: requestedDate, dateTo: requestedDate, limit: 8 });
  if (!slots.length) {
    return {
      message: `У ${master.name} на выбранную дату свободного времени нет. Выберите другой день.`,
      actions: [{ type: 'reply', label: 'Посмотреть завтра', message: `Хочу ${selectedService.name} у ${master.name} завтра` }, { type: 'reply', label: 'Послезавтра', message: `Хочу ${selectedService.name} у ${master.name} послезавтра` }],
      toolsUsed: ['list_services', 'list_masters', 'find_available_slots'],
    };
  }

  return {
    message: `Нашёл свободное время для услуги «${selectedService.name}» у мастера ${master.name}. Выберите вариант — запись появится только после вашего подтверждения.`,
    actions: slots.map((slot) => {
      const startsAt = slot.startsAt || slot.start_time;
      return {
        type: 'booking_slot',
        label: new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(startsAt)),
        booking: { serviceId: selectedService.id, serviceName: selectedService.name, masterId: master.id, masterName: master.name, startsAt },
      };
    }),
    toolsUsed: ['list_services', 'list_masters', 'find_available_slots'],
  };
}
