package com.contasfacil.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.WebViewListener;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.EditText;
import android.widget.FrameLayout;

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
                        "window.__contasFacilLastDomInputAt=0;" +
                        "window.__contasFacilImeFallbackApplying=false;" +
                        "window.__contasFacilNativeEditorAvailable=!!window.ContasFacilKeyboard;" +
                        "var activeNativeEl=null,restoreNativeStyle=null,lastNativePayload='';" +
                        "function isEditable(el){return el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable);}" +
                        "function markInput(){if(!window.__contasFacilImeFallbackApplying)window.__contasFacilLastDomInputAt=Date.now();}" +
                        "function setValue(el,value){var setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,value);}" +
                        "function dispatch(el,type,data){window.__contasFacilImeFallbackApplying=true;try{try{el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:type,data:data||null}));}catch(e){el.dispatchEvent(new Event('input',{bubbles:true}));}el.dispatchEvent(new Event('change',{bubbles:true}));}finally{setTimeout(function(){window.__contasFacilImeFallbackApplying=false;},0);}}" +
                        "function restore(){if(restoreNativeStyle){restoreNativeStyle();restoreNativeStyle=null;}activeNativeEl=null;}" +
                        "function beginNativeEditor(el){" +
                        " if(!window.ContasFacilKeyboard||!window.ContasFacilKeyboard.beginEdit||!isEditable(el)||!('value' in el))return;" +
                        " activeNativeEl=el;" +
                        " if(!el.id)el.id='cf-native-input-'+Math.random().toString(36).slice(2);" +
                        " var oldColor=el.style.webkitTextFillColor,oldCaret=el.style.caretColor;" +
                        " if(restoreNativeStyle)restoreNativeStyle();" +
                        " restoreNativeStyle=function(){el.style.webkitTextFillColor=oldColor;el.style.caretColor=oldCaret;};" +
                        " el.style.webkitTextFillColor='transparent';el.style.caretColor='transparent';" +
                        " var r=el.getBoundingClientRect(),cs=getComputedStyle(el);" +
                        " var payload={id:el.id,value:el.value||'',type:el.type||'',inputMode:el.inputMode||'',multiline:el.tagName==='TEXTAREA',rect:{x:r.left,y:r.top,w:r.width,h:r.height},viewport:{w:window.innerWidth,h:window.innerHeight},fontSize:parseFloat(cs.fontSize)||16,lineHeight:parseFloat(cs.lineHeight)||0,color:cs.color||'#111827',textAlign:cs.textAlign||'start',paddingLeft:parseFloat(cs.paddingLeft)||0,paddingRight:parseFloat(cs.paddingRight)||0,paddingTop:parseFloat(cs.paddingTop)||0,paddingBottom:parseFloat(cs.paddingBottom)||0};" +
                        " var json=JSON.stringify(payload); if(json===lastNativePayload)return; lastNativePayload=json;" +
                        " try{window.ContasFacilKeyboard.beginEdit(json);}catch(e){}" +
                        "}" +
                        "function fix(el){" +
                        " if(!isEditable(el))return;" +
                        " beginNativeEditor(el);" +
                        " try{window.ContasFacilKeyboard.onInputFocus(el.id||el.name||el.tagName||'input');}catch(e){}" +
                        "}" +
                        "function range(el){var s=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var e=typeof el.selectionEnd==='number'?el.selectionEnd:s;var c=window.__contasFacilImeFallbackComposition;if(c&&c.el===el){s=c.start;e=c.end;}return{s:s,e:e};}" +
                        "function replace(el,start,end,text,type){var next=el.value.slice(0,start)+text+el.value.slice(end);setValue(el,next);var pos=start+text.length;try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,type,text);return{el:el,start:start,end:pos};}" +
                        "window.__contasFacilNativeEditor={sync:function(value){var el=activeNativeEl;if(!isEditable(el)||!('value' in el))return;setValue(el,value);try{el.setSelectionRange(value.length,value.length);}catch(e){}dispatch(el,'insertReplacementText',value);},end:function(){restore();lastNativePayload='';}};" +
                        "window.__contasFacilImeFallback={" +
                        " composing:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);window.__contasFacilImeFallbackComposition=replace(el,r.s,r.e,text,'insertCompositionText');}," +
                        " commit:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);replace(el,r.s,r.e,text,'insertText');window.__contasFacilImeFallbackComposition=null;}," +
                        " backspace:function(){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;window.__contasFacilImeFallbackComposition=null;var start=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var end=typeof el.selectionEnd==='number'?el.selectionEnd:start;if(start===0&&end===0)return;var next,pos;if(start!==end){next=el.value.slice(0,start)+el.value.slice(end);pos=start;}else{next=el.value.slice(0,start-1)+el.value.slice(end);pos=start-1;}setValue(el,next);try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,'deleteContentBackward',null);}" +
                        "};" +
                        "document.addEventListener('input',markInput,true);" +
                        "document.addEventListener('focusin',function(e){fix(e.target);},true);" +
                        "document.addEventListener('touchend',function(e){var el=e.target;if(isEditable(el)){setTimeout(function(){fix(el);},80);}},true);" +
                        "document.addEventListener('touchstart',function(e){if(!isEditable(e.target)){restore();lastNativePayload='';try{window.ContasFacilKeyboard.endEdit();}catch(x){}}},true);" +
                        "document.addEventListener('click',function(e){fix(e.target);},true);" +
                        "window.addEventListener('scroll',function(){if(activeNativeEl)setTimeout(function(){beginNativeEditor(activeNativeEl);},0);},true);" +
                        "window.visualViewport&&window.visualViewport.addEventListener('resize',function(){if(activeNativeEl)setTimeout(function(){beginNativeEditor(activeNativeEl);},0);});" +
                        "window.visualViewport&&window.visualViewport.addEventListener('scroll',function(){if(activeNativeEl)setTimeout(function(){beginNativeEditor(activeNativeEl);},0);});" +
                        "})();",
                null
        );
    }

    private class KeyboardImeBridge {
        private final WebView webView;
        private EditText nativeEditor;
        private boolean applyingFromJs = false;
        private boolean changingFromNative = false;

        KeyboardImeBridge(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void beginEdit(String payloadJson) {
            webView.post(() -> {
                try {
                    JSONObject payload = new JSONObject(payloadJson);
                    JSONObject rect = payload.getJSONObject("rect");
                    JSONObject viewport = payload.getJSONObject("viewport");

                    ensureNativeEditor();

                    String value = payload.optString("value", "");
                    String type = payload.optString("type", "");
                    String inputMode = payload.optString("inputMode", "");
                    boolean multiline = payload.optBoolean("multiline", false);

                    applyingFromJs = true;
                    nativeEditor.setSingleLine(!multiline);
                    nativeEditor.setMinLines(multiline ? 2 : 1);
                    nativeEditor.setMaxLines(multiline ? 5 : 1);
                    nativeEditor.setInputType(resolveInputType(type, inputMode, multiline));
                    nativeEditor.setImeOptions(multiline
                            ? EditorInfo.IME_ACTION_NONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI
                            : EditorInfo.IME_ACTION_DONE | EditorInfo.IME_FLAG_NO_EXTRACT_UI);
                    nativeEditor.setText(value);
                    nativeEditor.setSelection(nativeEditor.getText().length());
                    applyingFromJs = false;

                    int color = parseCssColor(payload.optString("color", ""));
                    nativeEditor.setTextColor(color);
                    nativeEditor.setHintTextColor(Color.TRANSPARENT);
                    nativeEditor.setTextSize(TypedValue.COMPLEX_UNIT_PX, scaled(payload.optDouble("fontSize", 16), viewport));
                    nativeEditor.setGravity(resolveGravity(payload.optString("textAlign", "start"), multiline));
                    nativeEditor.setPadding(
                            scaled(payload.optDouble("paddingLeft", 0), viewport),
                            scaled(payload.optDouble("paddingTop", 0), viewport),
                            scaled(payload.optDouble("paddingRight", 0), viewport),
                            scaled(payload.optDouble("paddingBottom", 0), viewport)
                    );

                    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                            Math.max(24, scaled(rect.optDouble("w", 1), viewport)),
                            Math.max(24, scaled(rect.optDouble("h", 1), viewport))
                    );
                    params.leftMargin = webView.getLeft() + scaled(rect.optDouble("x", 0), viewport);
                    params.topMargin = webView.getTop() + scaled(rect.optDouble("y", 0), viewport);
                    nativeEditor.setLayoutParams(params);
                    nativeEditor.setVisibility(View.VISIBLE);
                    nativeEditor.bringToFront();
                    nativeEditor.requestFocus();

                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.restartInput(nativeEditor);
                        imm.showSoftInput(nativeEditor, InputMethodManager.SHOW_IMPLICIT);
                    }
                } catch (Exception ex) {
                    Log.w(TAG, "Native editor begin failed", ex);
                }
            });
        }

        @JavascriptInterface
        public void endEdit() {
            webView.post(() -> {
                if (nativeEditor == null) return;
                nativeEditor.setVisibility(View.GONE);
                InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.hideSoftInputFromWindow(nativeEditor.getWindowToken(), 0);
            });
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

        private void ensureNativeEditor() {
            if (nativeEditor != null) return;

            nativeEditor = new EditText(MainActivity.this);
            nativeEditor.setId(View.generateViewId());
            nativeEditor.setBackgroundColor(Color.TRANSPARENT);
            nativeEditor.setIncludeFontPadding(false);
            nativeEditor.setSelectAllOnFocus(false);
            nativeEditor.setVisibility(View.GONE);
            nativeEditor.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
                @Override public void onTextChanged(CharSequence s, int start, int before, int count) {}

                @Override
                public void afterTextChanged(Editable s) {
                    if (applyingFromJs || changingFromNative) return;
                    changingFromNative = true;
                    String js = "window.__contasFacilNativeEditor&&window.__contasFacilNativeEditor.sync(" + JSONObject.quote(s.toString()) + ")";
                    webView.evaluateJavascript(js, null);
                    changingFromNative = false;
                }
            });
            nativeEditor.setOnEditorActionListener((v, actionId, event) -> {
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    endEdit();
                    webView.evaluateJavascript("window.__contasFacilNativeEditor&&window.__contasFacilNativeEditor.end()", null);
                    return true;
                }
                return false;
            });

            addContentView(nativeEditor, new FrameLayout.LayoutParams(1, 1, Gravity.TOP | Gravity.START));
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

        private int scaled(double cssPx, JSONObject viewport) {
            double viewportWidth = Math.max(1, viewport.optDouble("w", webView.getWidth()));
            double scale = webView.getWidth() / viewportWidth;
            return (int) Math.round(cssPx * scale);
        }

        private int resolveGravity(String textAlign, boolean multiline) {
            int vertical = multiline ? Gravity.TOP : Gravity.CENTER_VERTICAL;
            if ("center".equalsIgnoreCase(textAlign)) return vertical | Gravity.CENTER_HORIZONTAL;
            if ("right".equalsIgnoreCase(textAlign) || "end".equalsIgnoreCase(textAlign)) return vertical | Gravity.END;
            return vertical | Gravity.START;
        }

        private int parseCssColor(String cssColor) {
            try {
                if (cssColor != null && cssColor.startsWith("rgb")) {
                    String values = cssColor.substring(cssColor.indexOf('(') + 1, cssColor.indexOf(')'));
                    String[] parts = values.split(",");
                    int r = Integer.parseInt(parts[0].trim());
                    int g = Integer.parseInt(parts[1].trim());
                    int b = Integer.parseInt(parts[2].trim());
                    return Color.rgb(r, g, b);
                }
                if (cssColor != null && cssColor.startsWith("#")) return Color.parseColor(cssColor);
            } catch (Exception ignored) {}
            return Color.rgb(17, 24, 39);
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
