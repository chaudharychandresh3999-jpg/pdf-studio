# PDF Studio

Write, draw, format and save PDFs in Gujarati, Hindi and English. This repo builds an Android app (APK) automatically.

## Get the APK

1. Open the **Actions** tab and wait for **Build APK** to finish (about 3 to 5 minutes). You can also tap **Run workflow**.
2. Open **Releases**, then **PDF Studio (latest)**, and download `PDF-Studio.apk`.
3. Open the file on your phone and allow *Install unknown apps* when asked.

## What works in the app

Writing, formatting, drawing, background colour, gradient or photo, images, page breaks, and **Download PDF** (saved in your Downloads folder). Translate and Scan need Claude, so they only work when the page is opened inside Claude.

## How it is built

The page lives in `web/` as small parts. The workflow joins them into one `index.html`, puts it in `app/src/main/assets/`, and builds a WebView app with Gradle. `MainActivity.java` handles the photo picker and saves PDFs to Downloads.
