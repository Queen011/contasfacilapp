package com.contasfacil.app;

import android.content.Context;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputConnectionWrapper;

import com.getcapacitor.CapacitorWebView;

import org.json.JSONObject;

public class ContasFacilWebView extends CapacitorWebView {
    public ContasFacilWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection base = super.onCreateInputConnection(outAttrs);
        if (base == null) return null;

        outAttrs.imeOptions |= EditorInfo.IME_FLAG_NO_EXTRACT_UI;
        return new ImeFallbackConnection(base, true, this);
    }

    private void mirrorCommitText(CharSequence text) {
        if (text == null || text.length() == 0) return;
        postDelayed(() -> evaluateJavascript(
                "window.__contasFacilImeFallback && window.__contasFacilImeFallback.commit(" + JSONObject.quote(text.toString()) + ")",
                null
        ), 90);
    }

    private void mirrorBackspace() {
        postDelayed(() -> evaluateJavascript(
                "window.__contasFacilImeFallback && window.__contasFacilImeFallback.backspace()",
                null
        ), 90);
    }

    private static class ImeFallbackConnection extends InputConnectionWrapper {
        private final ContasFacilWebView webView;
        private long lastDeleteAt = 0;

        ImeFallbackConnection(InputConnection target, boolean mutable, ContasFacilWebView webView) {
            super(target, mutable);
            this.webView = webView;
        }

        @Override
        public boolean commitText(CharSequence text, int newCursorPosition) {
            boolean handled = super.commitText(text, newCursorPosition);
            webView.mirrorCommitText(text);
            return handled;
        }

        @Override
        public boolean setComposingText(CharSequence text, int newCursorPosition) {
            return super.setComposingText(text, newCursorPosition);
        }

        @Override
        public boolean deleteSurroundingText(int beforeLength, int afterLength) {
            boolean handled = super.deleteSurroundingText(beforeLength, afterLength);
            if (beforeLength > 0) webView.mirrorBackspace();
            return handled;
        }

        @Override
        public boolean sendKeyEvent(KeyEvent event) {
            boolean handled = super.sendKeyEvent(event);
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getKeyCode() == KeyEvent.KEYCODE_DEL) {
                long now = SystemClock.elapsedRealtime();
                if (now - lastDeleteAt > 80) {
                    lastDeleteAt = now;
                    webView.mirrorBackspace();
                }
            }
            return handled;
        }
    }
}