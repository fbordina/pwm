/*
 * Password Management Servlets (PWM)
 * http://code.google.com/p/pwm/
 *
 * Copyright (c) 2006-2009 Novell, Inc.
 * Copyright (c) 2009-2011 The PWM Project
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 */

package password.pwm;

import password.pwm.error.PwmUnrecoverableException;
import password.pwm.util.PwmLogger;
import password.pwm.util.stats.Statistic;

import javax.servlet.ServletContext;
import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.http.HttpSession;
import javax.servlet.http.HttpSessionActivationListener;
import javax.servlet.http.HttpSessionEvent;
import javax.servlet.http.HttpSessionListener;
import java.util.Collection;

/**
 * Servlet event listener, defined in web.xml
 *
 * @author Jason D. Rivard
 */
public class EventManager implements ServletContextListener, HttpSessionListener, HttpSessionActivationListener {
// ------------------------------ FIELDS ------------------------------

    // ----------------------------- CONSTANTS ----------------------------
    private static final PwmLogger LOGGER = PwmLogger.getLogger(EventManager.class);

// --------------------------- CONSTRUCTORS ---------------------------

    public EventManager()
    {
    }

// ------------------------ INTERFACE METHODS ------------------------


// --------------------- Interface HttpSessionListener ---------------------

    public void sessionCreated(final HttpSessionEvent httpSessionEvent)
    {
        final HttpSession httpSession = httpSessionEvent.getSession();

        try {
            final PwmSession pwmSession = PwmSession.getPwmSession(httpSession);
            final PwmApplication pwmApplication = pwmSession.getPwmApplication();

            if (pwmApplication != null) {
                if (pwmApplication.getStatisticsManager() != null) {
                    pwmApplication.getStatisticsManager().incrementValue(Statistic.HTTP_SESSIONS);
                }
                pwmApplication.addPwmSession(pwmSession);
            }

            LOGGER.trace(pwmSession, "http session created");
        } catch (PwmUnrecoverableException e) {
            LOGGER.error("unable to establish pwm session: " + e.getMessage());
        }

        // add a few grace seconds to the idle interval
        if (httpSession.getMaxInactiveInterval() % 60 == 0) {
            httpSession.setMaxInactiveInterval(httpSession.getMaxInactiveInterval() + 2);
        }
    }

    public void sessionDestroyed(final HttpSessionEvent httpSessionEvent)
    {
        try {
            final PwmSession pwmSession = PwmSession.getPwmSession(httpSessionEvent.getSession());
            LOGGER.trace(pwmSession, "http session destroyed");
            pwmSession.getSessionManager().closeConnections();
        } catch (PwmUnrecoverableException e) {
            LOGGER.error("unable to destroy pwm session: " + e.getMessage());
        }
    }

// --------------------- Interface ServletContextListener ---------------------

    public void contextInitialized(final ServletContextEvent servletContextEvent)
    {
        if (null != servletContextEvent.getServletContext().getAttribute(PwmConstants.CONTEXT_ATTR_CONTEXT_MANAGER)) {
            LOGGER.warn("notice, previous servlet PwmApplication exists");
        }


        try {
            final PwmApplication newPwmApplication = new PwmApplication();
            newPwmApplication.initialize(servletContextEvent.getServletContext());
            servletContextEvent.getServletContext().setAttribute(PwmConstants.CONTEXT_ATTR_CONTEXT_MANAGER, newPwmApplication);
        } catch (OutOfMemoryError e) {
            LOGGER.fatal("JAVA OUT OF MEMORY ERROR!, please allocate more memory for java: " + e.getMessage(),e);
            throw e;
        } catch (Exception e) {
            LOGGER.fatal("error initializing pwm context: " + e, e);
            System.err.println("error initializing pwm context: " + e);
        }
    }

    public void contextDestroyed(final ServletContextEvent servletContextEvent)
    {
        try {
            final PwmApplication pwmApplication = PwmApplication.getPwmApplication(servletContextEvent.getServletContext());
            pwmApplication.shutdown();
        } catch (PwmUnrecoverableException e) {
            LOGGER.error("unable to destroy pwm context: " + e.getMessage());
        }
    }


// --------------------- Interface HttpSessionActivationListener ---------------------

    public void sessionWillPassivate(final HttpSessionEvent event)
    {
        try {
            final PwmSession pwmSession = PwmSession.getPwmSession(event.getSession());
            LOGGER.trace(pwmSession,"passivating session");
            pwmSession.getSessionManager().closeConnections();
        } catch (PwmUnrecoverableException e) {
            LOGGER.error("unable to passivate pwm context: " + e.getMessage());
        }
    }

    public void sessionDidActivate(final HttpSessionEvent event)
    {
        try {
            final PwmSession pwmSession = PwmSession.getPwmSession(event.getSession());
            LOGGER.trace(pwmSession,"activating (de-passivating) session");
        } catch (PwmUnrecoverableException e) {
            LOGGER.error("unable to activate  pwm context: " + e.getMessage());
        }
    }

    public static void reinitializeContext(final ServletContext servletContext) {
        LOGGER.info("restarting PWM application");

        try {
            final PwmApplication currentManager = PwmApplication.getPwmApplication(servletContext);
            servletContext.setAttribute(PwmConstants.CONTEXT_ATTR_CONTEXT_MANAGER, null);
            final Collection<PwmSession> allSessions = currentManager.getPwmSessions();
            currentManager.shutdown();
            invalidateAllUserSessions(allSessions);
        } catch (Throwable e) {
            LOGGER.fatal("error trying to shutdown PwmApplication during restart");
        }

        try {
            final PwmApplication newPwmApplication = new PwmApplication();
            newPwmApplication.initialize(servletContext);
            servletContext.setAttribute(PwmConstants.CONTEXT_ATTR_CONTEXT_MANAGER, newPwmApplication);
        } catch (OutOfMemoryError e) {
            LOGGER.fatal("JAVA OUT OF MEMORY ERROR!, please allocate more memory for java: " + e.getMessage(),e);
            throw e;
        } catch (Exception e) {
            LOGGER.fatal("error initializing pwm context: " + e, e);
            System.err.println("error initializing pwm context: " + e);
        }
    }

    private static void invalidateAllUserSessions(final Collection<PwmSession> sessions) {
        if (sessions == null || sessions.isEmpty()) {
            return;
        }

        for (final PwmSession pwmSession : sessions) {
            pwmSession.invalidate();
        }
    }
}

