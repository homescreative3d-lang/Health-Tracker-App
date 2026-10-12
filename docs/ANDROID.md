# Tended Android app (alarms that ring on a locked phone)

The Android app wraps the same web app with [Capacitor](https://capacitorjs.com). It adds one capability that browsers can't provide: **real alarms**. Upcoming reminder slots are scheduled as local notifications through Android's `AlarmManager` (`allowWhileIdle`), on a high-importance channel with the chosen tone and vibration. They ring even when Tended is closed and the phone is locked.

## What's included
- **`frontend/capacitor.config.ts`:** app id `app.tended.care`, plus the web build in `dist/`.
- **`frontend/android/`:** the generated Android project, with:
  - **Alarm sounds:** `res/raw/tended_{chime,beep,bells,pulse}.wav`, original tones synthesized to match the in-app tones.
  - **Status-bar icon:** `res/drawable/ic_stat_tended.png`.
  - **Permissions:** `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE` and `WAKE_LOCK`.
- **`frontend/src/lib/nativeAlarms.ts`:**
  - Inside the app, it re-schedules the next alarm slots (up to 60) whenever doses or settings change.
  - Each tone has its own channel. It uses the same cadence as notifications (first reminder, repeats, on-time alert).
  - In a browser it does nothing.

## Build an APK
Requirements: Android Studio (latest) with SDK 35 and JDK 17+.

```bash
cd frontend
npm install
npm run android:sync     # builds the web app and copies it into android/
npm run android:open     # opens Android Studio
```

In Android Studio, choose **Build → Build Bundle(s)/APK(s)**, or press Run with a device connected.

Point the app at your API by setting `VITE_API_URL` before building (the same variable the web build uses).

## Behaviour notes
- **First launch:** Android 13+ asks for notification permission. For exact timing, Android 12+ may also ask the user to allow **Alarms & reminders** in system settings.
- **Custom sounds:** sounds a user uploads in the app play in-app only; Android notification channels can only use bundled sounds. Alarm channels use the four built-in tones.
- **Changing tones:** Android doesn't let an app change a channel's sound after it's created, so each tone has its own channel.

## Not verified in this environment
The project was generated and the code type-checks, but no APK was built or run here, because no Android SDK was available. Please build it and test on a real device before releasing:
1. Turn on Alarm mode.
2. Lock the phone and wait for a reminder slot.
3. Confirm it rings and vibrates.
4. Confirm the Taken and Snooze actions work.
