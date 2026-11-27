package com.pdfstudio.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final int REQ_PICK = 1;
    private static final int REQ_CAMERA = 2;

    private WebView web;
    private ValueCallback<Uri[]> chooserCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                return openChooser(callback, params);
            }
        });
        web.loadUrl("file:///android_asset/index.html");
    }

    private boolean openChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (chooserCallback != null) {
            chooserCallback.onReceiveValue(null);
        }
        chooserCallback = callback;
        try {
            if (params.isCaptureEnabled()) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, "scan_" + System.currentTimeMillis() + ".jpg");
                v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                startActivityForResult(cam, REQ_CAMERA);
            } else {
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("image/*");
                pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                        params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
                startActivityForResult(Intent.createChooser(pick, "Choose image"), REQ_PICK);
            }
        } catch (Exception e) {
            chooserCallback = null;
            callback.onReceiveValue(null);
        }
        return true;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if ((req != REQ_PICK && req != REQ_CAMERA) || chooserCallback == null) {
            return;
        }
        Uri[] result = null;
        if (req == REQ_CAMERA) {
            if (res == RESULT_OK && cameraUri != null) {
                result = new Uri[]{cameraUri};
            } else if (cameraUri != null) {
                try {
                    getContentResolver().delete(cameraUri, null, null);
                } catch (Exception ignored) {
                }
            }
            cameraUri = null;
        } else if (res == RESULT_OK) {
            result = WebChromeClient.FileChooserParams.parseResult(res, data);
        }
        chooserCallback.onReceiveValue(result);
        chooserCallback = null;
    }

    private void toast(final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
            }
        });
    }

    public class Bridge {
        @JavascriptInterface
        public void savePdf(String filename, String base64) {
            String name = filename == null ? "document.pdf" : filename.replaceAll("[\\\\/:*?\"<>|]+", "").trim();
            if (name.isEmpty()) {
                name = "document.pdf";
            }
            if (!name.toLowerCase().endsWith(".pdf")) {
                name = name + ".pdf";
            }
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) {
                    throw new RuntimeException("No download location");
                }
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    os.write(Base64.decode(base64, Base64.DEFAULT));
                }
                toast("Saved in Downloads: " + name);
            } catch (Exception e) {
                toast("Could not save the PDF");
            }
        }
    }
}
