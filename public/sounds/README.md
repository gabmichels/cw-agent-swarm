# Notification Sounds

This directory contains audio files for notification sounds in the Agent Swarm platform.

## Required Sound Files

The following sound files are expected by the notification system:

- `message.mp3` - Agent message notifications
- `success.mp3` - Task completion and success notifications  
- `alert.mp3` - System alerts
- `status.mp3` - Agent status change notifications
- `upload.mp3` - File processing notifications
- `error.mp3` - Error notifications
- `info.mp3` - Information notifications
- `warning.mp3` - Warning notifications

## Sound Requirements

- **Format**: MP3 format preferred for browser compatibility
- **Duration**: 0.5-2 seconds recommended for notification sounds
- **Volume**: Sounds should be normalized and not too loud
- **Size**: Keep files small (< 50KB each) for fast loading

## Adding Sounds

1. Add your sound files to this directory with the exact filenames listed above
2. Ensure they are in MP3 format
3. Test the sounds work in the notification system
4. Consider using royalty-free or Creative Commons licensed sounds

## Fallback Behavior

If sound files are missing, the notification system will:
- Log a warning to the console
- Continue to function without audio
- Still show visual toast notifications

## Default Sounds

Currently, the system expects these files but they are not included in the repository. You can:
- Add your own sound files
- Use system default sounds
- Disable sounds in the notification settings 