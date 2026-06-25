package com.contasfacil.app;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.WebViewListener;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

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
                        "function isEditable(el){return el&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA'||el.isContentEditable);}" +
                        "function markInput(){if(!window.__contasFacilImeFallbackApplying)window.__contasFacilLastDomInputAt=Date.now();}" +
                        "function fix(el){" +
                        " if(!isEditable(el))return;" +
                        " try{window.ContasFacilKeyboard.onInputFocus(el.id||el.name||el.tagName||'input');}catch(e){}" +
                        "}" +
                        "function setValue(el,value){var setter=Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,value);}" +
                        "function dispatch(el,type,data){window.__contasFacilImeFallbackApplying=true;try{try{el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:type,data:data||null}));}catch(e){el.dispatchEvent(new Event('input',{bubbles:true}));}el.dispatchEvent(new Event('change',{bubbles:true}));}finally{setTimeout(function(){window.__contasFacilImeFallbackApplying=false;},0);}}" +
                        "function range(el){var s=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var e=typeof el.selectionEnd==='number'?el.selectionEnd:s;var c=window.__contasFacilImeFallbackComposition;if(c&&c.el===el){s=c.start;e=c.end;}return{s:s,e:e};}" +
                        "function replace(el,start,end,text,type){var next=el.value.slice(0,start)+text+el.value.slice(end);setValue(el,next);var pos=start+text.length;try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,type,text);return{el:el,start:start,end:pos};}" +
                        "window.__contasFacilImeFallback={" +
                        " composing:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);window.__contasFacilImeFallbackComposition=replace(el,r.s,r.e,text,'insertCompositionText');}," +
                        " commit:function(text){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;var r=range(el);replace(el,r.s,r.e,text,'insertText');window.__contasFacilImeFallbackComposition=null;}," +
                        " backspace:function(){var el=document.activeElement;if(!isEditable(el)||!('value' in el))return;window.__contasFacilImeFallbackComposition=null;var start=typeof el.selectionStart==='number'?el.selectionStart:el.value.length;var end=typeof el.selectionEnd==='number'?el.selectionEnd:start;if(start===0&&end===0)return;var next,pos;if(start!==end){next=el.value.slice(0,start)+el.value.slice(end);pos=start;}else{next=el.value.slice(0,start-1)+el.value.slice(end);pos=start-1;}setValue(el,next);try{el.setSelectionRange(pos,pos);}catch(e){}dispatch(el,'deleteContentBackward',null);}" +
                        "};" +
                        "document.addEventListener('input',markInput,true);" +
                        "document.addEventListener('focusin',function(e){fix(e.target);},true);" +
                        "document.addEventListener('touchend',function(e){var el=e.target;if(isEditable(el)){setTimeout(function(){fix(el);},80);}},true);" +
                        "document.addEventListener('click',function(e){fix(e.target);},true);" +
                        "})();",
                null
        );
    }

    private static class KeyboardImeBridge {
        private final WebView webView;

        KeyboardImeBridge(WebView webView) {
            this.webView = webView;
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
