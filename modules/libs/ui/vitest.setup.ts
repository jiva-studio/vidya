// jsdom has no layout, so it implements neither of these. Reka's listbox calls
// both while moving the highlight, and without them every keyboard test ends in
// an unhandled rejection that has nothing to do with the component.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
}
