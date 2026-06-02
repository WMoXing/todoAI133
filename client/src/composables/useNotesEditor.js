import { ref } from 'vue'

export const colorOptions = [
  { color: '#f56c6c', label: '红' },
  { color: '#e6a23c', label: '橙' },
  { color: '#67c23a', label: '绿' },
  { color: '#409eff', label: '蓝' },
  { color: '#909399', label: '灰' },
  { color: '#e040fb', label: '紫' },
  { color: '#ff6f00', label: '深橙' },
  { color: '#00bfa5', label: '青' },
]

export function useNotesEditor() {
  const notesRef = ref(null)

  function onNotesInput(editingTask) {
    if (notesRef.value && editingTask) editingTask.notes = notesRef.value.innerHTML
  }

  function loadNotes(html) {
    if (notesRef.value) notesRef.value.innerHTML = html || ''
  }

  function applyColor(color) {
    if (!notesRef.value) return
    notesRef.value.focus()
    const sel = window.getSelection()
    const hasSelection = sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed
    if (hasSelection) {
      document.execCommand("foreColor", false, color)
    } else {
      const text = notesRef.value.textContent
      if (!text.trim()) {
        document.execCommand("foreColor", false, color)
        return
      }
      const html = notesRef.value.innerHTML.replace(/<span style="color:[^"]+">/g, "").replace(/<\/span>/g, "")
      notesRef.value.innerHTML = "<span style=\u0022color:" + color + "\u0022>" + html + "</span>"
    }
  }

  function clearColor() {
    if (!notesRef.value) return
    const html = notesRef.value.innerHTML.replace(/<span style="color:[^"]+">/g, "").replace(/<\/span>/g, "")
    notesRef.value.innerHTML = html
    notesRef.value.focus()
  }

  function previewNotes(notes) {
    if (!notes) return ''
    return '<span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">' + notes + '</span>'
  }

  return { notesRef, onNotesInput, loadNotes, applyColor, clearColor, previewNotes }
}