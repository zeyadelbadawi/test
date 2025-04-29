
function handleDoorEvent(isOpen) {
  if (isOpen !== lastDoorState) {
    lastDoorState = isOpen;
    doorEventTime = getCurrentTimeMs();

    if (isOpen) {
      doorOpened = true;
      debugLog("🚪 تم فتح الباب");
    } else {
      doorOpened = false;
      debugLog("🚪 تم إغلاق الباب");

      if (!countdownStarted) {
        countdownStarted = true;
        motionDetectedSinceLastDoorEvent = false;
        debugLog("⏱ بدء العد التنازلي");
        
        while (activeTimers.length > 0) {
          let timerID = activeTimers.pop();
          Timer.clear(timerID);
        }

        let timer30s = Timer.set(30000, false, function() {
          checkMotionSinceDoorEvent();
        });
        activeTimers.push(timer30s);
      } else {
        debugLog("🚪 تم فتح الباب مرة أخرى قبل انتهاء العد التنازلي");
        countdownStarted = false;
        motionDetectedSinceLastDoorEvent = false;
        debugLog("⏱ تم إيقاف العد التنازلي بسبب فتح الباب مرة أخرى");
        
        while (activeTimers.length > 0) {
          let timerID = activeTimers.pop();
          Timer.clear(timerID);
        }
        
        let timer30s = Timer.set(30000, false, function() {
          checkMotionSinceDoorEvent();
        });
        activeTimers.push(timer30s);
      }
    }
  }
}
