package com.contasfacil.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputConnectionWrapper;

import com.getcapacitor.CapacitorWebView;

import org.json.JSONObject;

public class ContasFacilWebView extends CapacitorWebView {
    private InputConnection capturedImeConnection;

    public ContasFacilWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
        ensureKeyboardCaptureMode(context);
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        outAttrs.imeOptions |= EditorInfo.IME_FLAG_NO_EXTRACT_UI;
        outAttrs.inputType |= EditorInfo.TYPE_CLASS_TEXT;

        InputConnection base = super.onCreateInputConnection(outAttrs);
        if (base == null) {
            base = new BaseInputConnection(this, false);
        }

        if (capturedImeConnection == null) {
            capturedImeConnection = new BaseInputConnection(this, false);
        }

        return new ImeFallbackConnection(base, true, this);
    }

    private void ensureKeyboardCaptureMode(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences("CapacitorSettings", Context.MODE_PRIVATE);
            prefs.edit().putBoolean("android.captureInput", true).apply();
        } catch (Exception ignored) {
            // Best-effort: capacitor.config.ts também ativa captureInput.
        }
    }

    private void mirrorCommitText(CharSequence text) {
        if (text == null || text.length() == 0) return;
        postDelayed(() -> evaluateJavascript(
                "window.__contasFacilImeFallback && window.__contasFacilImeFallback.commit(" + JSONObject.quote(text.toString()) + ")",
                null
        ), 90);
    }

    private void mirrorComposingText(CharSequence text) {
        if (text == null || text.length() == 0) return;
        postDelayed(() -> evaluateJavascript(
                "window.__contasFacilImeFallback && window.__contasFacilImeFallback.composing(" + JSONObject.quote(text.toString()) + ")",
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
            boolean handled = super.setComposingText(text, newCursorPosition);
            webView.mirrorComposingText(text);
            return handled;
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