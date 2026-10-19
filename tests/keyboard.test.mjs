import assert from 'node:assert/strict';
import {test, mock} from 'node:test';
import {submitOnEnter} from '../src/_internal/utils/Keyboard.ts';

test('Enter connects once and returns the async operation for Vue error handling', async () => {
    const result = Promise.resolve('connected');
    const submit = mock.fn(() => result);
    const preventDefault = mock.fn();
    assert.equal(submitOnEnter({key: 'Enter', isComposing: false, keyCode: 13, preventDefault}, submit), result);
    assert.equal(submit.mock.callCount(), 1);
    assert.equal(preventDefault.mock.callCount(), 1);
    assert.equal(await result, 'connected');
});

test('IME confirmation and other keys neither connect nor cancel the native input action', () => {
    for (const event of [
        {key: 'Enter', isComposing: true, keyCode: 13},
        {key: 'Enter', isComposing: false, keyCode: 229},
        {key: 'Process', isComposing: true, keyCode: 229},
        {key: 'Tab', isComposing: false, keyCode: 9},
    ]) {
        const submit = mock.fn();
        const preventDefault = mock.fn();
        submitOnEnter({...event, preventDefault}, submit);
        assert.equal(submit.mock.callCount(), 0);
        assert.equal(preventDefault.mock.callCount(), 0);
    }
});
