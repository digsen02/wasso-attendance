export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password) {
  if (String(password || "").length < PASSWORD_MIN_LENGTH) {
    throw new Error(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
  }
}

export function validateInternshipDates(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("실습 시작일은 종료일보다 늦을 수 없습니다.");
  }
}
