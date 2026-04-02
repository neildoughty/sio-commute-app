// Pure utility functions — extracted for testability

export function isUKSummerTime(d) {
  const y = d.getUTCFullYear();
  const lsm = new Date(Date.UTC(y, 2, 31)); lsm.setUTCDate(31 - lsm.getUTCDay());
  const lso = new Date(Date.UTC(y, 9, 31)); lso.setUTCDate(31 - lso.getUTCDay());
  return d >= new Date(lsm.getTime() + 3600000) && d < new Date(lso.getTime() + 3600000);
}

export function ukHour(d) {
  return (d.getUTCHours() + (isUKSummerTime(d) ? 1 : 0)) % 24;
}
