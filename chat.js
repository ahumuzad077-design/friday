// 🔊 F.R.I.D.A.Y. Voice Synthesizer (MCU Accent & Tone Tuning)
function speak(text) {
  return new Promise((resolve) => {
    const safeText = text.replace(/["'\r\n]/g, " ");
    const psCommand = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      
      # Attempt to load Irish (en-IE) or British (en-GB) female voice culture
      try {
        $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-IE'));
      } catch {
        try {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female, [System.Speech.Synthesis.VoiceAge]::Adult, 0, [System.Globalization.CultureInfo]::GetCultureInfo('en-GB'));
        } catch {
          $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female);
        }
      }
      
      $synth.Rate = 0;   # Steady, articulate conversational pace
      $synth.Volume = 100;
      $synth.Speak('${safeText}');
    `;
    exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
      if (err) console.error("Speech Error:", err.message);
      resolve();
    });
  });
}
