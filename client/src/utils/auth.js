export function getCanEdit() {
  const token = localStorage.getItem('gc_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !payload.readOnly;
  } catch {
    return false;
  }
}
