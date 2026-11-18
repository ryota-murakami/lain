const shortlistKey = 'lain-design-shortlist-v1'
let shortlist = new Set()
let filter = 'All'
let toastTimeout

// A private browser setting must not break the review when storage is unavailable.
try {
  const saved = JSON.parse(localStorage.getItem(shortlistKey) || '[]')
  if (Array.isArray(saved))
    shortlist = new Set(saved.filter((id) => /^W(0[1-9]|1[0-2])$/.test(id)))
} catch {
  shortlist = new Set()
}

/**
 * Keeps shortlist buttons and filtered cards consistent after a review action.
 * Invoked after initial load, filtering, toggling or clearing the local shortlist.
 * @example
 * renderSelection()
 */
function renderSelection() {
  document.querySelectorAll('[data-shortlist]').forEach((button) => {
    const selected = shortlist.has(button.dataset.shortlist)
    button.setAttribute('aria-pressed', String(selected))
    button.textContent = button.closest('.candidate-banner')
      ? selected
        ? '★ Shortlisted'
        : '☆ Shortlist'
      : selected
        ? '★'
        : '☆'
  })
  let shown = 0
  document.querySelectorAll('[data-direction]').forEach((card) => {
    const visible =
      filter === 'All' ||
      card.dataset.category === filter ||
      (filter === 'Shortlisted' && shortlist.has(card.dataset.direction))
    card.hidden = !visible
    if (visible) shown += 1
  })
  document
    .querySelectorAll('[data-filter]')
    .forEach((button) =>
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.filter === filter),
      ),
    )
  const count = document.querySelector('#shown-count')
  if (count) count.textContent = `${shown} direction${shown === 1 ? '' : 's'}`
  const empty = document.querySelector('.shortlist-empty')
  if (empty) empty.hidden = filter !== 'Shortlisted' || shown !== 0
}

/**
 * Saves a local-only shortlist and announces the result without sending data.
 * @param message - The observable result of the visitor's latest shortlist action.
 * @example
 * saveSelection('W01 added to your shortlist')
 */
function saveSelection(message) {
  try {
    localStorage.setItem(shortlistKey, JSON.stringify([...shortlist]))
  } catch {
    message += '. Storage unavailable; this selection lasts for this page only.'
  }
  renderSelection()
  const toast = document.querySelector('.status-toast')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3000)
}

document.querySelectorAll('[data-shortlist]').forEach((button) => {
  button.addEventListener('click', () => {
    const id = button.dataset.shortlist
    if (shortlist.has(id)) shortlist.delete(id)
    else shortlist.add(id)
    saveSelection(
      `${id} ${shortlist.has(id) ? 'added to' : 'removed from'} your shortlist`,
    )
  })
})
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter
    renderSelection()
  })
})
document
  .querySelector('[data-clear-shortlist]')
  ?.addEventListener('click', () => {
    shortlist.clear()
    saveSelection('Your shortlist is clear')
  })

// Each synthetic workspace is isolated; no demo interaction calls a service.
document.querySelectorAll('[data-workspace]').forEach((workspace) => {
  const input = workspace.querySelector('input[type=search]')
  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase()
    let count = 0
    workspace.querySelectorAll('[data-search]').forEach((bookmark) => {
      const visible = bookmark.dataset.search.includes(query)
      bookmark.hidden = !visible
      if (visible) count += 1
    })
    workspace.querySelector('.demo-count').textContent =
      `${count} bookmark${count === 1 ? '' : 's'}`
    workspace.querySelector('.demo-empty').hidden = count !== 0
  })
  workspace.querySelectorAll('[data-view-button]').forEach((button) => {
    button.addEventListener('click', () => {
      workspace.dataset.view = button.dataset.viewButton
      workspace
        .querySelectorAll('[data-view-button]')
        .forEach((candidate) =>
          candidate.setAttribute('aria-pressed', String(candidate === button)),
        )
    })
  })
})
renderSelection()
