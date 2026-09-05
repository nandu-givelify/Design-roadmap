// iPadOS-style "stacked dialogs": when a dialog opens on top of another one,
// the dialog behind scales down slightly. Driven from JS (rather than a CSS
// :has() selector) because :has()-triggered style changes from DOM removal
// don't reliably participate in CSS transitions — toggling an inline style
// directly does.
let initialized = false

function applyStacking() {
  const dialogs = [...document.querySelectorAll('.MuiDialog-root')]
    .filter(el => !el.classList.contains('MuiModal-hidden'))
  dialogs.forEach((el, i) => {
    const paper = el.querySelector('.MuiDialog-paper')
    if (!paper) return
    paper.style.transform = i < dialogs.length - 1 ? 'scale(0.96)' : 'scale(1)'
  })
}

export function initStackedDialogs() {
  if (initialized) return
  initialized = true

  // Defer to the next painted frame: if we mutate styles synchronously in the
  // MutationObserver callback (which fires before the browser has painted the
  // DOM change), there's no committed "before" frame to transition from, and
  // the scale change snaps instead of animating.
  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => requestAnimationFrame(applyStacking))
  })
  observer.observe(document.body, {
    childList: true, subtree: true,
    attributes: true, attributeFilter: ['class'],
  })
  applyStacking()
}
