import { HttpError } from './httpError.js';

function getCancellationNoticeMinutes() {
  const value = Number(process.env.CANCELLATION_NOTICE_MINUTES ?? 120);
  return Number.isFinite(value) && value >= 0 ? value : 120;
}

export function assertBookingCanBeChanged(startsAt) {
  const startsAtMs = new Date(startsAt).getTime();
  if (!Number.isFinite(startsAtMs) || startsAtMs <= Date.now()) {
    throw new HttpError(400, 'Нельзя изменить прошедшую запись');
  }

  const noticeMinutes = getCancellationNoticeMinutes();
  const minutesUntilVisit = Math.floor((startsAtMs - Date.now()) / 60_000);
  if (minutesUntilVisit < noticeMinutes) {
    throw new HttpError(400, `Отмена и перенос доступны не позднее чем за ${noticeMinutes} мин. до визита`);
  }
}
