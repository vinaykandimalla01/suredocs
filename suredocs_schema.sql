--
-- PostgreSQL database dump
--

\restrict BaLJOWgkPwr4W2KFHvy6tP9v10fMO2W9rESOdPSviojcDajIjr91YN7Th7kMpQX

-- Dumped from database version 18.6 (Debian 18.6-1.pgdg12+2)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg12+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: auth_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(30) NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address character varying(45),
    user_agent text,
    details jsonb,
    CONSTRAINT auth_event_type CHECK (((event_type)::text = ANY ((ARRAY['LOGIN_SUCCESS'::character varying, 'LOGIN_FAILED'::character varying, 'LOGOUT'::character varying, 'ACCOUNT_LOCKED'::character varying, 'SESSION_REVOKED'::character varying, 'AUTH_REJECTED_INACTIVE'::character varying])::text[]))),
    CONSTRAINT ck_auth_events_event_type CHECK (((event_type)::text = ANY ((ARRAY['LOGIN_SUCCESS'::character varying, 'LOGIN_FAILED'::character varying, 'LOGOUT'::character varying, 'ACCOUNT_LOCKED'::character varying, 'SESSION_REVOKED'::character varying, 'AUTH_REJECTED_INACTIVE'::character varying])::text[])))
);


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    session_token_hash character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone,
    revoked_at timestamp with time zone,
    ip_address character varying(45),
    user_agent text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(150) NOT NULL,
    email character varying(320) NOT NULL,
    password_hash text,
    role character varying(20) NOT NULL,
    account_status character varying(20) NOT NULL,
    email_verified_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_changed_at timestamp with time zone,
    created_by uuid,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT account_status CHECK (((account_status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'DISABLED'::character varying])::text[]))),
    CONSTRAINT ck_users_account_status CHECK (((account_status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'DISABLED'::character varying])::text[]))),
    CONSTRAINT ck_users_active_requires_password CHECK ((((account_status)::text <> 'ACTIVE'::text) OR (password_hash IS NOT NULL))),
    CONSTRAINT ck_users_failed_login_nonneg CHECK ((failed_login_attempts >= 0)),
    CONSTRAINT ck_users_role CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'EMPLOYEE'::character varying])::text[]))),
    CONSTRAINT user_role CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'EMPLOYEE'::character varying])::text[])))
);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: auth_events auth_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_events
    ADD CONSTRAINT auth_events_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_session_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_session_token_hash_key UNIQUE (session_token_hash);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_auth_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_events_event_type ON public.auth_events USING btree (event_type);


--
-- Name: ix_auth_events_occurred_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_events_occurred_at ON public.auth_events USING btree (occurred_at);


--
-- Name: ix_auth_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_auth_events_user_id ON public.auth_events USING btree (user_id);


--
-- Name: ix_user_sessions_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
-- Name: ix_user_sessions_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_sessions_token_hash ON public.user_sessions USING btree (session_token_hash);


--
-- Name: ix_user_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: ix_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: auth_events auth_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_events
    ADD CONSTRAINT auth_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict BaLJOWgkPwr4W2KFHvy6tP9v10fMO2W9rESOdPSviojcDajIjr91YN7Th7kMpQX

