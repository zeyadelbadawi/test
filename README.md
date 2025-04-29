
  // handle door event logic
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
  
        // Reset flags if the countdown is restarted
        if (!countdownStarted) {
          countdownStarted = true;
          motionDetectedSinceLastDoorEvent = false;
          debugLog("⏱ بدء العد التنازلي");
          
          // Clear previous timers and set new ones
          while (activeTimers.length > 0) {
            let timerID = activeTimers.pop();
            Timer.clear(timerID);
          }
  
          let timer30s = Timer.set(30000, false, function() {
            checkMotionSinceDoorEvent();
          });
          activeTimers.push(timer30s);
        } else {
          // Reset the countdown if the door is opened again before timeout
          debugLog("🚪 تم فتح الباب مرة أخرى قبل انتهاء العد التنازلي");
          countdownStarted = false;
          motionDetectedSinceLastDoorEvent = false;
          debugLog("⏱ تم إيقاف العد التنازلي بسبب فتح الباب مرة أخرى");
          
          // Cancel the existing timers
          while (activeTimers.length > 0) {
            let timerID = activeTimers.pop();
            Timer.clear(timerID);
          }
          
          // Start the countdown again from 0
          let timer30s = Timer.set(30000, false, function() {
            checkMotionSinceDoorEvent();
          });
          activeTimers.push(timer30s);
        }
      }
    }
  }
  
