package com.contasfacil.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.WebViewListener;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.util.Log;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.EditText;

import org.json.JSONObject;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    private static final String TAG = "ContasFacilKeyboard";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                        | WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED
        );
        installKeyboardImeFix();
    }

    private void installKeyboardImeFix() {
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            Log.w(TAG, "WebView unavailable for keyboard fix");
            return;
        }

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.addJavascriptInterface(new KeyboardImeBridge(webView), "ContasFacilKeyboard");

        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView view) {
                injectKeyboardImeFix(view);
            }
        });

        webView.postDelayed(() -> injectKeyboardImeFix(webView), 500);
    }

    private void injectKeyboardImeFix(WebView webView) {
        webView.evaluateJavascript(
                "(function(){" +
                        "if(window.__contasFacilKeyboardFixInstalled)return;" +
                        "window.__contasFacilKeyboardFixInstalled=true;" +
                        "window.__contasFacilKeyboardBuild='IME v6 — dialog nativo Android — 25/06/2026';" +
                        "window.__contasFacilLastDomInputAt=0;" +
                        "window.__contasFacilImeFallbackApplying=false;" +
                        "window.__contasFacilNativeDialogAvailable=!!window.ContasFacilKeyboard;" +
                        "var nativeDialogGate=0,nativeDialogSuppressUntil=0;" +
                        "function isEditable(el){return el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable)&&!el.disabled&&!el.readOnly;}" +
                        "function plainTextType(el){var t=(el.type||'').toLowerCase();return ['date','time','month','week','color','file','checkbox','radio','range','button','submit','reset'].indexOf(t)<0;}" +
                        "function markInput(){if(!window.__contasFacilImeFallbackApplying)window.__contasFacilLastDomInputAt=Date.now();}" +
                        "function setValue(el,value){var setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,value);}" +
                        "function dispatch(el,type,data){window.__contasFacilImeFallbackApplying=true;try{try{el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:type,data:data||null}));}catch(e){el.dispatchEvent(new Event('input',{bubbles:true}));}el.dispatchEvent(new Event('change',{bubbles:true}));}finally{setTimeout(function(){window.__contasFacilImeFallbackApplying=false;},0);}}" +
                        "function getLabel(el){try{if(el.labels&&el.labels[0])return el.labels[0].innerText||el.labels[0].textContent||'';var id=el.id&&document.querySelector('label[for=\\\"'+CSS.escape(el.id)+'\\\"]');if(id)return id.innerText||id.textContent||'';}catch(e){}return el.getAttribute('aria-label')||el.placeholder||el.name||'Campo';}" +
                        "function openNativeDialog(el){" +
                        " if(!window.ContasFacilKeyboard||!window.ContasFacilKeyboard.editText||!isEditable(el)||!('value' in el)||!plainTextType(el))return;" +
                        " var now=Date.now(); if(now<nativeDialogSuppressUntil||now-nativeDialogGate<650)return; nativeDialogGate=now;" +
                        " if(!el.id)el.id='cf-input-'+Math.random().toString(36).slice(2);" +
                        " var payload={id:el.id,title:getLabel(el).trim().slice(0,60),value:el.value||'',type:el.type||'',inputMode:el.inputMode||'',multiline:el.tagName==='TEXTAREA',placeholder:el.placeholder||''};" +
                        " try{window.ContasFacilKeyboard.editText(JSON.stringify(payload));}catch(e){}" +
                        "}" +
                        "function fix(el,openDialog){" +
                        " if(!isEditable(el))return;" +
                        " try{window.ContasFacilKeyboard.onInputFocus(el.id||el.name||el.tagName||'input');}catch(e){}" +
                        " if(openDialog)openNativeDialog(el);" +
                        "}" +
                        "function range(el){var s=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var e=typeof el.selectionEnd==='number'?el.selectionEnd:s;var c=window.__contasFacilImeFallbackComposition;if(c&&c.el===el){s=c.start;e=c.end;}return{s:s,e:e};}" +
                        "function replace(el,start,end,text,type){var next=el.value.slice(0,start)+text+el.value.slice(end);setValue(el,next);var pos=start+text.length;try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,type,text);return{el:el,start:start,end:pos};}" +
                        "window.__contasFacilNativeDialogEditor={sync:function(id,value){var el=document.getElementById(id);if(!isEditable(el)||!('value' in el))return;nativeDialogSuppressUntil=Date.now()+1200;setValue(el,value);try{el.focus({preventScroll:true});el.setSelectionRange(value.length,value.length);}catch(e){}dispatch(el,'insertReplacementText',value);}};" +
                        "window.__contasFacilImeFallback={" +
                        " composing:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);window.__contasFacilImeFallbackComposition=replace(el,r.s,r.e,text,'insertCompositionText');}," +
                        " commit:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);replace(el,r.s,r.e,text,'insertText');window.__contasFacilImeFallbackComposition=null;}," +
                        " backspace:function(){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;window.__contasFacilImeFallbackComposition=null;var start=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var end=typeof el.selectionEnd==='number'?el.selectionEnd:start;if(start===0&&end===0)return;var next,pos;if(start!==end){next=el.value.slice(0,start)+el.value.slice(end);pos=start;}else{next=el.value.slice(0,start-1)+el.value.slice(end);pos=start-1;}setValue(el,next);try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,'deleteContentBackward',null);}" +
                        "};" +
                        "document.addEventListener('input',markInput,true);" +
                        "document.addEventListener('focusin',function(e){fix(e.target,true);},true);" +
                        "document.addEventListener('touchend',function(e){var el=e.target;if(isEditable(el)){setTimeout(function(){fix(el,true);},80);}},true);" +
                        "document.addEventListener('click',function(e){fix(e.target,true);},true);" +
                        "})();",
                null
        );
    }

    private class KeyboardImeBridge {
        private final WebView webView;

        KeyboardImeBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void editText(String payloadJson) {
            webView.post(() -> {
                try {
                    JSONObject payload = new JSONObject(payloadJson);
                    String id = payload.optString("id", "");
                    String title = payload.optString("title", "Campo");
                    String value = payload.optString("value", "");
                    String type = payload.optString("type", "");
                    String inputMode = payload.optString("inputMode", "");
                    boolean multiline = payload.optBoolean("multiline", false);
                    String placeholder = payload.optString("placeholder", "");

                    final EditText editor = new EditText(MainActivity.this);
                    editor.setSingleLine(!multiline);
                    editor.setMinLines(multiline ? 3 : 1);
                    editor.setMaxLines(multiline ? 6 : 1);
                    editor.setInputType(resolveInputType(type, inputMode, multiline));
                    editor.setImeOptions(multiline
                            ? EditorInfo.IME_ACTION_NONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI
                            : EditorInfo.IME_ACTION_DONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
                    editor.setText(value);
                    editor.setHint(placeholder);
                    editor.setSelectAllOnFocus(false);
                    editor.setSelection(editor.getText().length());

                    final AlertDialog[] dialogRef = new AlertDialog[1];
                    AlertDialog dialog = new AlertDialog.Builder(MainActivity.this)
                            .setTitle(title == null || title.length() == 0 ? "Editar campo" : title)
                            .setView(editor)
                            .setPositiveButton("Aplicar", (dialogInterface, which) -> syncDialogValue(id, editor.getText().toString()))
                            .setNegativeButton("Cancelar", null)
                            .create();
                    dialogRef[0] = dialog;

                    editor.setOnEditorActionListener((v, actionId, event) -> {
                        boolean enter = event != null
                                && event.getAction() == android.view.KeyEvent.ACTION_DOWN
                                && event.getKeyCode() == android.view.KeyEvent.KEYCODE_ENTER;
                        if (!multiline && (actionId == EditorInfo.IME_ACTION_DONE || enter)) {
                            syncDialogValue(id, editor.getText().toString());
                            if (dialogRef[0] != null) dialogRef[0].dismiss();
                            return true;
                        }
                        return false;
                    });

                    dialog.setOnShowListener(d -> {
                        if (dialog.getWindow() != null) {
                            dialog.getWindow().setSoftInputMode(
                                    WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                                            | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
                            );
                        }
                        editor.requestFocus();
                        editor.postDelayed(() -> {
                            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                            if (imm != null) {
                                imm.restartInput(editor);
                                imm.showSoftInput(editor, InputMethodManager.SHOW_IMPLICIT);
                            }
                        }, 120);
                    });

                    dialog.show();
                } catch (Exception ex) {
                    Log.w(TAG, "Native dialog editor failed", ex);
                }
            });
        }

        @JavascriptInterface
        public void endEdit() {
            // Mantido por compatibilidade com versões anteriores do JavaScript injetado.
        }

        @JavascriptInterface
        public void onInputFocus(String source) {
            webView.post(() -> {
                try {
                    webView.requestFocus();
                    InputMethodManager imm = (InputMethodManager) webView.getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.restartInput(webView);
                    }
                    Log.d(TAG, "IME restarted for " + source);
                } catch (Exception ex) {
                    Log.w(TAG, "Failed to restart IME", ex);
                }
            });
        }

        private void syncDialogValue(String id, String value) {
            if (id == null || id.length() == 0) return;
            String js = "window.__contasFacilNativeDialogEditor&&window.__contasFacilNativeDialogEditor.sync("
                    + JSONObject.quote(id) + "," + JSONObject.quote(value == null ? "" : value) + ")";
            webView.evaluateJavascript(js, null);
        }

        private int resolveInputType(String type, String inputMode, boolean multiline) {
            int flags = multiline
                    ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                    : InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES;
            if ("password".equalsIgnoreCase(type)) {
                return InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD;
            }
            if ("email".equalsIgnoreCase(type) || "email".equalsIgnoreCase(inputMode)) {
                return InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS;
            }
            if ("tel".equalsIgnoreCase(type) || "tel".equalsIgnoreCase(inputMode)) {
                return InputType.TYPE_CLASS_PHONE;
            }
            if ("number".equalsIgnoreCase(type) || "numeric".equalsIgnoreCase(inputMode)) {
                return InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL | InputType.TYPE_NUMBER_FLAG_SIGNED;
            }
            if ("decimal".equalsIgnoreCase(inputMode)) {
                return InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_FLAG_DECIMAL;
            }
            return flags;
        }
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle == null) {
                Log.i("Google Activity Result", "SocialLogin plugin handle is null");
                return;
            }

            Plugin plugin = pluginHandle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
                return;
            }

            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
