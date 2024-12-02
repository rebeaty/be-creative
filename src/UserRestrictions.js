import { useEffect } from 'react';

const UserRestrictions = () => {
  useEffect(() => {
    const preventDefaultWrapper = (e) => {
      // Allow actions in the ProlificID input field
      if (e.target.id === 'prolificId') return;
      
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const disableKeyboardShortcuts = (e) => {
      // Allow in ProlificID input
      if (e.target.id === 'prolificId') return;
      
      // Handle both Windows (ctrlKey) and Mac (metaKey)
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'c' || key === 'v' || key === 'x') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    // Handle drag and drop
    const preventDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Disable text selection except for inputs and textareas
    const preventSelect = (e) => {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        return false;
      }
    };

    // Add all event listeners with capture phase
    document.addEventListener('copy', preventDefaultWrapper, true);
    document.addEventListener('paste', preventDefaultWrapper, true);
    document.addEventListener('cut', preventDefaultWrapper, true);
    document.addEventListener('contextmenu', preventDefaultWrapper, true);
    document.addEventListener('keydown', disableKeyboardShortcuts, true);
    document.addEventListener('dragstart', preventDrag, true);
    document.addEventListener('drop', preventDrag, true);
    document.addEventListener('selectstart', preventSelect, true);

    // CSS to disable user-select
    const style = document.createElement('style');
    style.innerHTML = `
      :not(input):not(textarea) {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.removeEventListener('copy', preventDefaultWrapper, true);
      document.removeEventListener('paste', preventDefaultWrapper, true);
      document.removeEventListener('cut', preventDefaultWrapper, true);
      document.removeEventListener('contextmenu', preventDefaultWrapper, true);
      document.removeEventListener('keydown', disableKeyboardShortcuts, true);
      document.removeEventListener('dragstart', preventDrag, true);
      document.removeEventListener('drop', preventDrag, true);
      document.removeEventListener('selectstart', preventSelect, true);
      document.head.removeChild(style);
    };
  }, []);

  return null;
};

export default UserRestrictions;