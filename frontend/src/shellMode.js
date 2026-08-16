export const SHELL_KEY = 'cc-shell'
export const SHELL_EVENT = 'cc-shell-change'

export function getShell() {
  try {
    return localStorage.getItem(SHELL_KEY) === 'classic' ? 'classic' : 'gate'
  } catch {
    return 'gate'
  }
}

export function setShell(mode) {
  const next = mode === 'classic' ? 'classic' : 'gate'
  localStorage.setItem(SHELL_KEY, next)
  window.dispatchEvent(new CustomEvent(SHELL_EVENT, { detail: next }))
}
