import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import { Menu, MenuLabel, MenuContent, MenuItem } from '../../../../../components';

import css from './LanguageSwitcher.module.css';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../../../../../app';

// Language configurations
export const LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'es',
    label: 'Español',
    flag: '🇪🇸',
  },
  {
    code: 'fr',
    label: 'Français',
    flag: '🇫🇷',
  },
];

/**
 * LanguageSwitcher component for switching between English, Spanish, and French
 * Saves the selected language to localStorage
 *
 * @component
 * @param {Object} props
 * @param {Function} props.onLanguageChange - Callback function when language changes
 * @returns {JSX.Element} language switcher component
 */
const LanguageSwitcher = ({ onLanguageChange }) => {
  // Get initial language from localStorage or use default
  const getInitialLanguage = () => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage && LANGUAGES.find(lang => lang.code === savedLanguage)) {
        return savedLanguage;
      }
    }
    return DEFAULT_LANGUAGE;
  };

  const [currentLanguage, setCurrentLanguage] = useState(getInitialLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageChange = languageCode => {
    setCurrentLanguage(languageCode);

    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    }

    // Call the callback if provided
    if (onLanguageChange) {
      onLanguageChange(languageCode);
    }

    // Force a hard reload with cache clear to ensure clean state
    if (typeof window !== 'undefined') {
      window.location.href = window.location.href;
    }
  };

  // Get current language object
  const currentLang = LANGUAGES.find(lang => lang.code === currentLanguage) || LANGUAGES[0];

  if (!mounted) {
    return null;
  }

  return (
    <div className={css.root}>
      <Menu>
        <MenuLabel className={css.languageMenuLabel} isOpenClassName={css.languageMenuIsOpen}>
          <div className={css.currentLanguage}>
            <span className={css.flag}>{currentLang.flag}</span>
            <span className={css.languageCode}>{currentLang.code.toUpperCase()}</span>
          </div>
        </MenuLabel>
        <MenuContent className={css.languageMenuContent}>
          {LANGUAGES.map(language => (
            <MenuItem key={language.code}>
              <button
                className={classNames(css.languageOption, {
                  [css.activeLanguage]: language.code === currentLanguage,
                })}
                onClick={() => handleLanguageChange(language.code)}
                type="button"
              >
                <span className={css.flag}>{language.flag}</span>
                <span className={css.languageLabel}>{language.label}</span>
                {language.code === currentLanguage && <span className={css.checkmark}>✓</span>}
              </button>
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
};

export default LanguageSwitcher;
