/**
 *  TopbarMobileMenu prints the menu content for authenticated user or
 * shows login actions for those who are not authenticated.
 */
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import { ACCOUNT_SETTINGS_PAGES } from '../../../../routing/routeConfiguration';
import { FormattedMessage } from '../../../../util/reactIntl';
import { ensureCurrentUser } from '../../../../util/data';

import {
  AvatarLarge,
  ExternalLink,
  IconArrowHead,
  InlineTextButton,
  NamedLink,
  NotificationBadge,
} from '../../../../components';

import css from './TopbarMobileMenu.module.css';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from '../../../../app';
import { LANGUAGES } from '../TopbarDesktop/LanguageSwitcher/LanguageSwitcher';

const CustomDropDownLanguage = props => {
  const { isDropdownOpen, setIsDropdownOpen } = props;

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
    <div className={css.dataLinksWrapper}>
      <div style={{ cursor: 'pointer' }}>
        <div onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
          <span className={css.langLabel}>
            <span className={css.languageFlag}>{currentLang.flag}</span> {currentLang.label}
          </span>
          <IconArrowHead
            direction={isDropdownOpen ? 'up' : 'down'}
            size="small"
            className={css.arrow}
          />
        </div>
        {isDropdownOpen && (
          <div className={css.dropdownContent}>
            {LANGUAGES.map(language => (
              <div key={language.code}>
                <button
                  className={classNames(css.languageOption, {
                    [css.activeLanguage]: language.code === currentLanguage,
                  })}
                  onClick={() => handleLanguageChange(language.code)}
                  type="button"
                >
                  <span className={css.languageFlag}>{language.flag}</span>
                  <span className={css.languageLabel}>{language.label}</span>
                  {language.code === currentLanguage && <span className={css.checkmark}>✓</span>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomLinkComponent = ({ linkConfig, currentPage }) => {
  const { group, text, type, href, route } = linkConfig;
  const getCurrentPageClass = page => {
    const hasPageName = name => currentPage?.indexOf(name) === 0;
    const isCMSPage = pageId => hasPageName('CMSPage') && currentPage === `${page}:${pageId}`;
    const isInboxPage = tab => hasPageName('InboxPage') && currentPage === `${page}:${tab}`;
    const isCurrentPage = currentPage === page;

    return isCMSPage(route?.params?.pageId) || isInboxPage(route?.params?.tab) || isCurrentPage
      ? css.currentPage
      : null;
  };

  // Note: if the config contains 'route' keyword,
  // then in-app linking config has been resolved already.
  if (type === 'internal' && route) {
    // Internal link
    const { name, params, to } = route || {};
    const className = classNames(css.navigationLink, getCurrentPageClass(name));
    return (
      <NamedLink name={name} params={params} to={to} className={className}>
        <span className={css.menuItemBorder} />
        {text}
      </NamedLink>
    );
  }
  return (
    <ExternalLink href={href} className={css.navigationLink}>
      <span className={css.menuItemBorder} />
      {text}
    </ExternalLink>
  );
};

/**
 * Menu for mobile layout (opens through hamburger icon)
 *
 * @component
 * @param {Object} props
 * @param {boolean} props.isAuthenticated
 * @param {string?} props.currentPage
 * @param {boolean} props.currentUserHasListings
 * @param {Object?} props.currentUser API entity
 * @param {number} props.notificationCount
 * @param {Array<Object>} props.customLinks Contains object like { group, text, type, href, route }
 * @param {Function} props.onLogout
 * @returns {JSX.Element} search icon
 */
const TopbarMobileMenu = props => {
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);

  const {
    isAuthenticated,
    currentPage,
    inboxTab,
    currentUser,
    notificationCount = 0,
    customLinks,
    onLogout,
    showCreateListingsLink,
  } = props;

  const user = ensureCurrentUser(currentUser);

  const extraLinks = customLinks.map((linkConfig, index) => {
    return (
      <CustomLinkComponent
        key={`${linkConfig.text}_${index}`}
        linkConfig={linkConfig}
        currentPage={currentPage}
      />
    );
  });

  const createListingsLinkMaybe = showCreateListingsLink ? (
    <NamedLink className={css.createNewListingLink} name="NewListingPage">
      <FormattedMessage id="TopbarMobileMenu.newListingLink" />
    </NamedLink>
  ) : null;

  if (!isAuthenticated) {
    const signup = (
      <NamedLink name="SignupPage" className={css.signupLink}>
        <FormattedMessage id="TopbarMobileMenu.signupLink" />
      </NamedLink>
    );

    const login = (
      <NamedLink name="LoginPage" className={css.loginLink}>
        <FormattedMessage id="TopbarMobileMenu.loginLink" />
      </NamedLink>
    );

    const signupOrLogin = (
      <span className={css.authenticationLinks}>
        <FormattedMessage
          id="TopbarMobileMenu.signupOrLogin"
          values={{ lineBreak: <br />, signup, login }}
        />
      </span>
    );
    return (
      <nav className={css.root}>
        <div className={css.content}>
          <div className={css.authenticationGreeting}>
            <FormattedMessage
              id="TopbarMobileMenu.unauthorizedGreeting"
              values={{ lineBreak: <br />, signupOrLogin }}
            />
          </div>

          <div className={css.customLinksWrapper}>{extraLinks}</div>

          <CustomDropDownLanguage
            isDropdownOpen={isLanguageDropdownOpen}
            setIsDropdownOpen={setIsLanguageDropdownOpen}
          />

          <div className={css.spacer} />
        </div>
        <div className={css.footer}>{createListingsLinkMaybe}</div>
      </nav>
    );
  }

  const notificationCountBadge =
    notificationCount > 0 ? (
      <NotificationBadge className={css.notificationBadge} count={notificationCount} />
    ) : null;

  const displayName = user.attributes.profile.firstName;
  const currentPageClass = page => {
    const isAccountSettingsPage =
      page === 'AccountSettingsPage' && ACCOUNT_SETTINGS_PAGES.includes(currentPage);
    const isInboxPage = currentPage?.indexOf('InboxPage') === 0 && page?.indexOf('InboxPage') === 0;
    return currentPage === page || isAccountSettingsPage || isInboxPage ? css.currentPage : null;
  };

  const manageListingsLinkMaybe = showCreateListingsLink ? (
    <NamedLink
      className={classNames(css.navigationLink, currentPageClass('ManageListingsPage'))}
      name="ManageListingsPage"
    >
      <FormattedMessage id="TopbarMobileMenu.yourListingsLink" />
    </NamedLink>
  ) : null;

  return (
    <div className={css.root}>
      <AvatarLarge className={css.avatar} user={currentUser} />
      <div className={css.content}>
        <span className={css.greeting}>
          <FormattedMessage id="TopbarMobileMenu.greeting" values={{ displayName }} />
        </span>
        <InlineTextButton rootClassName={css.logoutButton} onClick={onLogout}>
          <FormattedMessage id="TopbarMobileMenu.logoutLink" />
        </InlineTextButton>

        <div className={css.accountLinksWrapper}>
          <NamedLink
            className={classNames(css.inbox, currentPageClass(`InboxPage:${inboxTab}`))}
            name="InboxPage"
            params={{ tab: inboxTab }}
          >
            <FormattedMessage id="TopbarMobileMenu.inboxLink" />
            {notificationCountBadge}
          </NamedLink>
          {manageListingsLinkMaybe}
          <NamedLink
            className={classNames(css.navigationLink, currentPageClass('ProfileSettingsPage'))}
            name="ProfileSettingsPage"
          >
            <FormattedMessage id="TopbarMobileMenu.profileSettingsLink" />
          </NamedLink>
          <NamedLink
            className={classNames(css.navigationLink, currentPageClass('AccountSettingsPage'))}
            name="AccountSettingsPage"
          >
            <FormattedMessage id="TopbarMobileMenu.accountSettingsLink" />
          </NamedLink>
        </div>
        <div className={css.customLinksWrapper}>{extraLinks}</div>

        <CustomDropDownLanguage
          isDropdownOpen={isLanguageDropdownOpen}
          setIsDropdownOpen={setIsLanguageDropdownOpen}
        />

        <div className={css.spacer} />
      </div>
      <div className={css.footer}>{createListingsLinkMaybe}</div>
    </div>
  );
};

export default TopbarMobileMenu;
