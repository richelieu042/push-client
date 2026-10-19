export function submitOnEnter(event: KeyboardEvent, submit: () => unknown) {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) {
        return;
    }
    event.preventDefault();
    return submit();
}
