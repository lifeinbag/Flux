--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

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

--
-- Name: enum_brokers_terminal; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_brokers_terminal AS ENUM (
    'MT4',
    'MT5'
);


--
-- Name: enum_users_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enum_users_role AS ENUM (
    'user',
    'admin'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_sets (
    id uuid NOT NULL,
    "userId" uuid NOT NULL,
    name character varying(255) DEFAULT 'New Set'::character varying NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "futureSymbol" character varying(255),
    "spotSymbol" character varying(255),
    "symbolsLocked" boolean DEFAULT false NOT NULL,
    "companyMappings" json,
    "premiumTableName" character varying(255)
);


--
-- Name: COLUMN account_sets."companyMappings"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account_sets."companyMappings" IS 'Stores broker terminal to company name mappings';


--
-- Name: COLUMN account_sets."premiumTableName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.account_sets."premiumTableName" IS 'Reference to the premium table name for this symbol pair + company combination';


--
-- Name: bid_ask_equiti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_equiti (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_equiti_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_equiti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_equiti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_equiti_id_seq OWNED BY public.bid_ask_equiti.id;


--
-- Name: bid_ask_exness; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_exness (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_exness_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_exness_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_exness_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_exness_id_seq OWNED BY public.bid_ask_exness.id;


--
-- Name: bid_ask_icmarkets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_icmarkets (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_icmarkets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_icmarkets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_icmarkets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_icmarkets_id_seq OWNED BY public.bid_ask_icmarkets.id;


--
-- Name: bid_ask_mhmarket; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_mhmarket (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_mhmarket_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_mhmarket_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_mhmarket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_mhmarket_id_seq OWNED BY public.bid_ask_mhmarket.id;


--
-- Name: bid_ask_octafx; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_octafx (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_octafx_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_octafx_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_octafx_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_octafx_id_seq OWNED BY public.bid_ask_octafx.id;


--
-- Name: bid_ask_vpfx; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_vpfx (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_vpfx_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_vpfx_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_vpfx_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_vpfx_id_seq OWNED BY public.bid_ask_vpfx.id;


--
-- Name: bid_ask_xm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_ask_xm (
    id integer NOT NULL,
    symbol character varying(50) NOT NULL,
    bid numeric(15,8),
    ask numeric(15,8),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: bid_ask_xm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_ask_xm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_ask_xm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_ask_xm_id_seq OWNED BY public.bid_ask_xm.id;


--
-- Name: broker_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broker_mappings (
    id integer NOT NULL,
    user_input character varying(255) NOT NULL,
    normalized_name character varying(100) NOT NULL,
    confidence_score numeric(3,2) DEFAULT 0.00,
    server_pattern character varying(255),
    company_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    usage_count integer DEFAULT 1
);


--
-- Name: broker_mappings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.broker_mappings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: broker_mappings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.broker_mappings_id_seq OWNED BY public.broker_mappings.id;


--
-- Name: broker_symbols_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.broker_symbols_cache (
    id integer NOT NULL,
    normalized_broker_name character varying(100) NOT NULL,
    terminal character varying(10) NOT NULL,
    symbols_data jsonb NOT NULL,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    source_server character varying(255),
    source_broker_name character varying(255)
);


--
-- Name: broker_symbols_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.broker_symbols_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: broker_symbols_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.broker_symbols_cache_id_seq OWNED BY public.broker_symbols_cache.id;


--
-- Name: brokers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brokers (
    id uuid NOT NULL,
    "accountSetId" uuid NOT NULL,
    terminal public.enum_brokers_terminal NOT NULL,
    "accountNumber" character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    server character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    token character varying(255),
    "tokenExpiresAt" timestamp with time zone,
    "brokerName" character varying(255) NOT NULL,
    "companyName" character varying(255),
    "position" integer DEFAULT 1 NOT NULL
);


--
-- Name: COLUMN brokers.token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brokers.token IS 'Trading session token from broker connection';


--
-- Name: COLUMN brokers."tokenExpiresAt"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brokers."tokenExpiresAt" IS 'Token expiration timestamp';


--
-- Name: COLUMN brokers."brokerName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brokers."brokerName" IS 'User-defined broker name for table organization';


--
-- Name: COLUMN brokers."companyName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brokers."companyName" IS 'Company name extracted from broker API for data mapping';


--
-- Name: COLUMN brokers."position"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.brokers."position" IS 'Order position of broker within an account set (1 for first, 2 for second)';


--
-- Name: otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otps (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: premium_equiti_exness_gcq5_vs_xauusdm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_equiti_exness_gcq5_vs_xauusdm (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_equiti_exness_gcq5_vs_xauusdm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_equiti_exness_gcq5_vs_xauusdm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_equiti_exness_gcq5_vs_xauusdm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_equiti_exness_gcq5_vs_xauusdm_id_seq OWNED BY public.premium_equiti_exness_gcq5_vs_xauusdm.id;


--
-- Name: premium_equiti_icmarkets_gcq5_vs_xauusd; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_equiti_icmarkets_gcq5_vs_xauusd (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_equiti_icmarkets_gcq5_vs_xauusd_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_equiti_icmarkets_gcq5_vs_xauusd_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_equiti_icmarkets_gcq5_vs_xauusd_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_equiti_icmarkets_gcq5_vs_xauusd_id_seq OWNED BY public.premium_equiti_icmarkets_gcq5_vs_xauusd.id;


--
-- Name: premium_equiti_xm_gcq5_vs_gold; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_equiti_xm_gcq5_vs_gold (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_equiti_xm_gcq5_vs_gold_; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_equiti_xm_gcq5_vs_gold_ (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_equiti_xm_gcq5_vs_gold__id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_equiti_xm_gcq5_vs_gold__id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_equiti_xm_gcq5_vs_gold__id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_equiti_xm_gcq5_vs_gold__id_seq OWNED BY public.premium_equiti_xm_gcq5_vs_gold_.id;


--
-- Name: premium_equiti_xm_gcq5_vs_gold_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_equiti_xm_gcq5_vs_gold_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_equiti_xm_gcq5_vs_gold_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_equiti_xm_gcq5_vs_gold_id_seq OWNED BY public.premium_equiti_xm_gcq5_vs_gold.id;


--
-- Name: premium_equiti_xm_gcz5_vs_gold_; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_equiti_xm_gcz5_vs_gold_ (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_equiti_xm_gcz5_vs_gold__id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_equiti_xm_gcz5_vs_gold__id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_equiti_xm_gcz5_vs_gold__id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_equiti_xm_gcz5_vs_gold__id_seq OWNED BY public.premium_equiti_xm_gcz5_vs_gold_.id;


--
-- Name: premium_icmarkets_exness_gcq25_vs_xauusdm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_icmarkets_exness_gcq25_vs_xauusdm (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_icmarkets_exness_gcq25_vs_xauusdm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_icmarkets_exness_gcq25_vs_xauusdm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_icmarkets_exness_gcq25_vs_xauusdm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_icmarkets_exness_gcq25_vs_xauusdm_id_seq OWNED BY public.premium_icmarkets_exness_gcq25_vs_xauusdm.id;


--
-- Name: premium_icmarkets_exness_gcz25_vs_xauusdm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_icmarkets_exness_gcz25_vs_xauusdm (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_icmarkets_exness_gcz25_vs_xauusdm_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_icmarkets_exness_gcz25_vs_xauusdm_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_icmarkets_exness_gcz25_vs_xauusdm_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_icmarkets_exness_gcz25_vs_xauusdm_id_seq OWNED BY public.premium_icmarkets_exness_gcz25_vs_xauusdm.id;


--
-- Name: premium_icmarkets_mhmarket_gcz25_vs_xauusd; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_icmarkets_mhmarket_gcz25_vs_xauusd (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_icmarkets_mhmarket_gcz25_vs_xauusd_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_icmarkets_mhmarket_gcz25_vs_xauusd_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_icmarkets_mhmarket_gcz25_vs_xauusd_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_icmarkets_mhmarket_gcz25_vs_xauusd_id_seq OWNED BY public.premium_icmarkets_mhmarket_gcz25_vs_xauusd.id;


--
-- Name: premium_vpfx_octafx_gc_q25_vs_xauusd; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_vpfx_octafx_gc_q25_vs_xauusd (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_vpfx_octafx_gc_q25_vs_xauusd_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_vpfx_octafx_gc_q25_vs_xauusd_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_vpfx_octafx_gc_q25_vs_xauusd_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_vpfx_octafx_gc_q25_vs_xauusd_id_seq OWNED BY public.premium_vpfx_octafx_gc_q25_vs_xauusd.id;


--
-- Name: premium_vpfx_octafx_gc_z25_vs_xauusd; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_vpfx_octafx_gc_z25_vs_xauusd (
    id integer NOT NULL,
    account_set_id character varying(255),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    future_bid numeric(15,8),
    future_ask numeric(15,8),
    spot_bid numeric(15,8),
    spot_ask numeric(15,8),
    buy_premium numeric(15,8),
    sell_premium numeric(15,8)
);


--
-- Name: premium_vpfx_octafx_gc_z25_vs_xauusd_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.premium_vpfx_octafx_gc_z25_vs_xauusd_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: premium_vpfx_octafx_gc_z25_vs_xauusd_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.premium_vpfx_octafx_gc_z25_vs_xauusd_id_seq OWNED BY public.premium_vpfx_octafx_gc_z25_vs_xauusd.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role public.enum_users_role DEFAULT 'user'::public.enum_users_role,
    "sponsorId" uuid,
    "mt4Account" character varying(255) DEFAULT ''::character varying,
    "mt5Account" character varying(255) DEFAULT ''::character varying,
    "referralCode" character varying(255),
    "tradingAccounts" jsonb DEFAULT '[]'::jsonb,
    "level1Share" numeric(5,2) DEFAULT NULL::numeric,
    "level2Share" numeric(5,2) DEFAULT NULL::numeric,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: bid_ask_equiti id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_equiti ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_equiti_id_seq'::regclass);


--
-- Name: bid_ask_exness id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_exness ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_exness_id_seq'::regclass);


--
-- Name: bid_ask_icmarkets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_icmarkets ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_icmarkets_id_seq'::regclass);


--
-- Name: bid_ask_mhmarket id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_mhmarket ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_mhmarket_id_seq'::regclass);


--
-- Name: bid_ask_octafx id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_octafx ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_octafx_id_seq'::regclass);


--
-- Name: bid_ask_vpfx id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_vpfx ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_vpfx_id_seq'::regclass);


--
-- Name: bid_ask_xm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_xm ALTER COLUMN id SET DEFAULT nextval('public.bid_ask_xm_id_seq'::regclass);


--
-- Name: broker_mappings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_mappings ALTER COLUMN id SET DEFAULT nextval('public.broker_mappings_id_seq'::regclass);


--
-- Name: broker_symbols_cache id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_symbols_cache ALTER COLUMN id SET DEFAULT nextval('public.broker_symbols_cache_id_seq'::regclass);


--
-- Name: premium_equiti_exness_gcq5_vs_xauusdm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_exness_gcq5_vs_xauusdm ALTER COLUMN id SET DEFAULT nextval('public.premium_equiti_exness_gcq5_vs_xauusdm_id_seq'::regclass);


--
-- Name: premium_equiti_icmarkets_gcq5_vs_xauusd id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_icmarkets_gcq5_vs_xauusd ALTER COLUMN id SET DEFAULT nextval('public.premium_equiti_icmarkets_gcq5_vs_xauusd_id_seq'::regclass);


--
-- Name: premium_equiti_xm_gcq5_vs_gold id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcq5_vs_gold ALTER COLUMN id SET DEFAULT nextval('public.premium_equiti_xm_gcq5_vs_gold_id_seq'::regclass);


--
-- Name: premium_equiti_xm_gcq5_vs_gold_ id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcq5_vs_gold_ ALTER COLUMN id SET DEFAULT nextval('public.premium_equiti_xm_gcq5_vs_gold__id_seq'::regclass);


--
-- Name: premium_equiti_xm_gcz5_vs_gold_ id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcz5_vs_gold_ ALTER COLUMN id SET DEFAULT nextval('public.premium_equiti_xm_gcz5_vs_gold__id_seq'::regclass);


--
-- Name: premium_icmarkets_exness_gcq25_vs_xauusdm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_exness_gcq25_vs_xauusdm ALTER COLUMN id SET DEFAULT nextval('public.premium_icmarkets_exness_gcq25_vs_xauusdm_id_seq'::regclass);


--
-- Name: premium_icmarkets_exness_gcz25_vs_xauusdm id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_exness_gcz25_vs_xauusdm ALTER COLUMN id SET DEFAULT nextval('public.premium_icmarkets_exness_gcz25_vs_xauusdm_id_seq'::regclass);


--
-- Name: premium_icmarkets_mhmarket_gcz25_vs_xauusd id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_mhmarket_gcz25_vs_xauusd ALTER COLUMN id SET DEFAULT nextval('public.premium_icmarkets_mhmarket_gcz25_vs_xauusd_id_seq'::regclass);


--
-- Name: premium_vpfx_octafx_gc_q25_vs_xauusd id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_vpfx_octafx_gc_q25_vs_xauusd ALTER COLUMN id SET DEFAULT nextval('public.premium_vpfx_octafx_gc_q25_vs_xauusd_id_seq'::regclass);


--
-- Name: premium_vpfx_octafx_gc_z25_vs_xauusd id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_vpfx_octafx_gc_z25_vs_xauusd ALTER COLUMN id SET DEFAULT nextval('public.premium_vpfx_octafx_gc_z25_vs_xauusd_id_seq'::regclass);


--
-- Name: account_sets account_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_sets
    ADD CONSTRAINT account_sets_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_equiti bid_ask_equiti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_equiti
    ADD CONSTRAINT bid_ask_equiti_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_exness bid_ask_exness_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_exness
    ADD CONSTRAINT bid_ask_exness_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_icmarkets bid_ask_icmarkets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_icmarkets
    ADD CONSTRAINT bid_ask_icmarkets_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_mhmarket bid_ask_mhmarket_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_mhmarket
    ADD CONSTRAINT bid_ask_mhmarket_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_octafx bid_ask_octafx_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_octafx
    ADD CONSTRAINT bid_ask_octafx_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_vpfx bid_ask_vpfx_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_vpfx
    ADD CONSTRAINT bid_ask_vpfx_pkey PRIMARY KEY (id);


--
-- Name: bid_ask_xm bid_ask_xm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_ask_xm
    ADD CONSTRAINT bid_ask_xm_pkey PRIMARY KEY (id);


--
-- Name: broker_mappings broker_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_mappings
    ADD CONSTRAINT broker_mappings_pkey PRIMARY KEY (id);


--
-- Name: broker_symbols_cache broker_symbols_cache_normalized_broker_name_terminal_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_symbols_cache
    ADD CONSTRAINT broker_symbols_cache_normalized_broker_name_terminal_key UNIQUE (normalized_broker_name, terminal);


--
-- Name: broker_symbols_cache broker_symbols_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.broker_symbols_cache
    ADD CONSTRAINT broker_symbols_cache_pkey PRIMARY KEY (id);


--
-- Name: brokers brokers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT brokers_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: premium_equiti_exness_gcq5_vs_xauusdm premium_equiti_exness_gcq5_vs_xauusdm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_exness_gcq5_vs_xauusdm
    ADD CONSTRAINT premium_equiti_exness_gcq5_vs_xauusdm_pkey PRIMARY KEY (id);


--
-- Name: premium_equiti_icmarkets_gcq5_vs_xauusd premium_equiti_icmarkets_gcq5_vs_xauusd_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_icmarkets_gcq5_vs_xauusd
    ADD CONSTRAINT premium_equiti_icmarkets_gcq5_vs_xauusd_pkey PRIMARY KEY (id);


--
-- Name: premium_equiti_xm_gcq5_vs_gold_ premium_equiti_xm_gcq5_vs_gold__pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcq5_vs_gold_
    ADD CONSTRAINT premium_equiti_xm_gcq5_vs_gold__pkey PRIMARY KEY (id);


--
-- Name: premium_equiti_xm_gcq5_vs_gold premium_equiti_xm_gcq5_vs_gold_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcq5_vs_gold
    ADD CONSTRAINT premium_equiti_xm_gcq5_vs_gold_pkey PRIMARY KEY (id);


--
-- Name: premium_equiti_xm_gcz5_vs_gold_ premium_equiti_xm_gcz5_vs_gold__pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_equiti_xm_gcz5_vs_gold_
    ADD CONSTRAINT premium_equiti_xm_gcz5_vs_gold__pkey PRIMARY KEY (id);


--
-- Name: premium_icmarkets_exness_gcq25_vs_xauusdm premium_icmarkets_exness_gcq25_vs_xauusdm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_exness_gcq25_vs_xauusdm
    ADD CONSTRAINT premium_icmarkets_exness_gcq25_vs_xauusdm_pkey PRIMARY KEY (id);


--
-- Name: premium_icmarkets_exness_gcz25_vs_xauusdm premium_icmarkets_exness_gcz25_vs_xauusdm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_exness_gcz25_vs_xauusdm
    ADD CONSTRAINT premium_icmarkets_exness_gcz25_vs_xauusdm_pkey PRIMARY KEY (id);


--
-- Name: premium_icmarkets_mhmarket_gcz25_vs_xauusd premium_icmarkets_mhmarket_gcz25_vs_xauusd_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_icmarkets_mhmarket_gcz25_vs_xauusd
    ADD CONSTRAINT premium_icmarkets_mhmarket_gcz25_vs_xauusd_pkey PRIMARY KEY (id);


--
-- Name: premium_vpfx_octafx_gc_q25_vs_xauusd premium_vpfx_octafx_gc_q25_vs_xauusd_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_vpfx_octafx_gc_q25_vs_xauusd
    ADD CONSTRAINT premium_vpfx_octafx_gc_q25_vs_xauusd_pkey PRIMARY KEY (id);


--
-- Name: premium_vpfx_octafx_gc_z25_vs_xauusd premium_vpfx_octafx_gc_z25_vs_xauusd_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_vpfx_octafx_gc_z25_vs_xauusd
    ADD CONSTRAINT premium_vpfx_octafx_gc_z25_vs_xauusd_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_email_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key1 UNIQUE (email);


--
-- Name: users users_email_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key10 UNIQUE (email);


--
-- Name: users users_email_key100; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key100 UNIQUE (email);


--
-- Name: users users_email_key101; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key101 UNIQUE (email);


--
-- Name: users users_email_key102; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key102 UNIQUE (email);


--
-- Name: users users_email_key103; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key103 UNIQUE (email);


--
-- Name: users users_email_key104; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key104 UNIQUE (email);


--
-- Name: users users_email_key105; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key105 UNIQUE (email);


--
-- Name: users users_email_key106; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key106 UNIQUE (email);


--
-- Name: users users_email_key107; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key107 UNIQUE (email);


--
-- Name: users users_email_key108; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key108 UNIQUE (email);


--
-- Name: users users_email_key109; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key109 UNIQUE (email);


--
-- Name: users users_email_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key11 UNIQUE (email);


--
-- Name: users users_email_key110; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key110 UNIQUE (email);


--
-- Name: users users_email_key111; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key111 UNIQUE (email);


--
-- Name: users users_email_key112; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key112 UNIQUE (email);


--
-- Name: users users_email_key113; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key113 UNIQUE (email);


--
-- Name: users users_email_key114; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key114 UNIQUE (email);


--
-- Name: users users_email_key115; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key115 UNIQUE (email);


--
-- Name: users users_email_key116; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key116 UNIQUE (email);


--
-- Name: users users_email_key117; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key117 UNIQUE (email);


--
-- Name: users users_email_key118; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key118 UNIQUE (email);


--
-- Name: users users_email_key119; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key119 UNIQUE (email);


--
-- Name: users users_email_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key12 UNIQUE (email);


--
-- Name: users users_email_key120; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key120 UNIQUE (email);


--
-- Name: users users_email_key121; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key121 UNIQUE (email);


--
-- Name: users users_email_key122; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key122 UNIQUE (email);


--
-- Name: users users_email_key123; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key123 UNIQUE (email);


--
-- Name: users users_email_key124; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key124 UNIQUE (email);


--
-- Name: users users_email_key125; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key125 UNIQUE (email);


--
-- Name: users users_email_key126; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key126 UNIQUE (email);


--
-- Name: users users_email_key127; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key127 UNIQUE (email);


--
-- Name: users users_email_key128; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key128 UNIQUE (email);


--
-- Name: users users_email_key129; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key129 UNIQUE (email);


--
-- Name: users users_email_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key13 UNIQUE (email);


--
-- Name: users users_email_key130; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key130 UNIQUE (email);


--
-- Name: users users_email_key131; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key131 UNIQUE (email);


--
-- Name: users users_email_key132; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key132 UNIQUE (email);


--
-- Name: users users_email_key133; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key133 UNIQUE (email);


--
-- Name: users users_email_key134; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key134 UNIQUE (email);


--
-- Name: users users_email_key135; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key135 UNIQUE (email);


--
-- Name: users users_email_key136; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key136 UNIQUE (email);


--
-- Name: users users_email_key137; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key137 UNIQUE (email);


--
-- Name: users users_email_key138; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key138 UNIQUE (email);


--
-- Name: users users_email_key139; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key139 UNIQUE (email);


--
-- Name: users users_email_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key14 UNIQUE (email);


--
-- Name: users users_email_key140; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key140 UNIQUE (email);


--
-- Name: users users_email_key141; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key141 UNIQUE (email);


--
-- Name: users users_email_key142; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key142 UNIQUE (email);


--
-- Name: users users_email_key143; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key143 UNIQUE (email);


--
-- Name: users users_email_key144; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key144 UNIQUE (email);


--
-- Name: users users_email_key145; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key145 UNIQUE (email);


--
-- Name: users users_email_key146; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key146 UNIQUE (email);


--
-- Name: users users_email_key147; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key147 UNIQUE (email);


--
-- Name: users users_email_key148; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key148 UNIQUE (email);


--
-- Name: users users_email_key149; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key149 UNIQUE (email);


--
-- Name: users users_email_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key15 UNIQUE (email);


--
-- Name: users users_email_key150; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key150 UNIQUE (email);


--
-- Name: users users_email_key151; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key151 UNIQUE (email);


--
-- Name: users users_email_key152; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key152 UNIQUE (email);


--
-- Name: users users_email_key153; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key153 UNIQUE (email);


--
-- Name: users users_email_key154; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key154 UNIQUE (email);


--
-- Name: users users_email_key155; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key155 UNIQUE (email);


--
-- Name: users users_email_key156; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key156 UNIQUE (email);


--
-- Name: users users_email_key157; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key157 UNIQUE (email);


--
-- Name: users users_email_key158; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key158 UNIQUE (email);


--
-- Name: users users_email_key159; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key159 UNIQUE (email);


--
-- Name: users users_email_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key16 UNIQUE (email);


--
-- Name: users users_email_key160; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key160 UNIQUE (email);


--
-- Name: users users_email_key161; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key161 UNIQUE (email);


--
-- Name: users users_email_key162; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key162 UNIQUE (email);


--
-- Name: users users_email_key163; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key163 UNIQUE (email);


--
-- Name: users users_email_key164; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key164 UNIQUE (email);


--
-- Name: users users_email_key165; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key165 UNIQUE (email);


--
-- Name: users users_email_key166; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key166 UNIQUE (email);


--
-- Name: users users_email_key167; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key167 UNIQUE (email);


--
-- Name: users users_email_key168; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key168 UNIQUE (email);


--
-- Name: users users_email_key169; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key169 UNIQUE (email);


--
-- Name: users users_email_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key17 UNIQUE (email);


--
-- Name: users users_email_key170; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key170 UNIQUE (email);


--
-- Name: users users_email_key171; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key171 UNIQUE (email);


--
-- Name: users users_email_key172; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key172 UNIQUE (email);


--
-- Name: users users_email_key173; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key173 UNIQUE (email);


--
-- Name: users users_email_key174; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key174 UNIQUE (email);


--
-- Name: users users_email_key175; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key175 UNIQUE (email);


--
-- Name: users users_email_key176; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key176 UNIQUE (email);


--
-- Name: users users_email_key177; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key177 UNIQUE (email);


--
-- Name: users users_email_key178; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key178 UNIQUE (email);


--
-- Name: users users_email_key179; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key179 UNIQUE (email);


--
-- Name: users users_email_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key18 UNIQUE (email);


--
-- Name: users users_email_key180; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key180 UNIQUE (email);


--
-- Name: users users_email_key181; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key181 UNIQUE (email);


--
-- Name: users users_email_key182; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key182 UNIQUE (email);


--
-- Name: users users_email_key183; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key183 UNIQUE (email);


--
-- Name: users users_email_key184; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key184 UNIQUE (email);


--
-- Name: users users_email_key185; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key185 UNIQUE (email);


--
-- Name: users users_email_key186; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key186 UNIQUE (email);


--
-- Name: users users_email_key187; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key187 UNIQUE (email);


--
-- Name: users users_email_key188; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key188 UNIQUE (email);


--
-- Name: users users_email_key189; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key189 UNIQUE (email);


--
-- Name: users users_email_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key19 UNIQUE (email);


--
-- Name: users users_email_key190; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key190 UNIQUE (email);


--
-- Name: users users_email_key191; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key191 UNIQUE (email);


--
-- Name: users users_email_key192; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key192 UNIQUE (email);


--
-- Name: users users_email_key193; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key193 UNIQUE (email);


--
-- Name: users users_email_key194; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key194 UNIQUE (email);


--
-- Name: users users_email_key195; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key195 UNIQUE (email);


--
-- Name: users users_email_key196; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key196 UNIQUE (email);


--
-- Name: users users_email_key197; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key197 UNIQUE (email);


--
-- Name: users users_email_key198; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key198 UNIQUE (email);


--
-- Name: users users_email_key199; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key199 UNIQUE (email);


--
-- Name: users users_email_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key2 UNIQUE (email);


--
-- Name: users users_email_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key20 UNIQUE (email);


--
-- Name: users users_email_key200; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key200 UNIQUE (email);


--
-- Name: users users_email_key201; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key201 UNIQUE (email);


--
-- Name: users users_email_key202; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key202 UNIQUE (email);


--
-- Name: users users_email_key203; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key203 UNIQUE (email);


--
-- Name: users users_email_key204; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key204 UNIQUE (email);


--
-- Name: users users_email_key205; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key205 UNIQUE (email);


--
-- Name: users users_email_key206; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key206 UNIQUE (email);


--
-- Name: users users_email_key207; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key207 UNIQUE (email);


--
-- Name: users users_email_key208; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key208 UNIQUE (email);


--
-- Name: users users_email_key209; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key209 UNIQUE (email);


--
-- Name: users users_email_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key21 UNIQUE (email);


--
-- Name: users users_email_key210; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key210 UNIQUE (email);


--
-- Name: users users_email_key211; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key211 UNIQUE (email);


--
-- Name: users users_email_key212; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key212 UNIQUE (email);


--
-- Name: users users_email_key213; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key213 UNIQUE (email);


--
-- Name: users users_email_key214; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key214 UNIQUE (email);


--
-- Name: users users_email_key215; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key215 UNIQUE (email);


--
-- Name: users users_email_key216; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key216 UNIQUE (email);


--
-- Name: users users_email_key217; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key217 UNIQUE (email);


--
-- Name: users users_email_key218; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key218 UNIQUE (email);


--
-- Name: users users_email_key219; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key219 UNIQUE (email);


--
-- Name: users users_email_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key22 UNIQUE (email);


--
-- Name: users users_email_key220; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key220 UNIQUE (email);


--
-- Name: users users_email_key221; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key221 UNIQUE (email);


--
-- Name: users users_email_key222; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key222 UNIQUE (email);


--
-- Name: users users_email_key223; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key223 UNIQUE (email);


--
-- Name: users users_email_key224; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key224 UNIQUE (email);


--
-- Name: users users_email_key225; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key225 UNIQUE (email);


--
-- Name: users users_email_key226; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key226 UNIQUE (email);


--
-- Name: users users_email_key227; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key227 UNIQUE (email);


--
-- Name: users users_email_key228; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key228 UNIQUE (email);


--
-- Name: users users_email_key229; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key229 UNIQUE (email);


--
-- Name: users users_email_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key23 UNIQUE (email);


--
-- Name: users users_email_key230; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key230 UNIQUE (email);


--
-- Name: users users_email_key231; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key231 UNIQUE (email);


--
-- Name: users users_email_key232; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key232 UNIQUE (email);


--
-- Name: users users_email_key233; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key233 UNIQUE (email);


--
-- Name: users users_email_key234; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key234 UNIQUE (email);


--
-- Name: users users_email_key235; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key235 UNIQUE (email);


--
-- Name: users users_email_key236; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key236 UNIQUE (email);


--
-- Name: users users_email_key237; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key237 UNIQUE (email);


--
-- Name: users users_email_key238; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key238 UNIQUE (email);


--
-- Name: users users_email_key239; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key239 UNIQUE (email);


--
-- Name: users users_email_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key24 UNIQUE (email);


--
-- Name: users users_email_key240; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key240 UNIQUE (email);


--
-- Name: users users_email_key241; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key241 UNIQUE (email);


--
-- Name: users users_email_key242; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key242 UNIQUE (email);


--
-- Name: users users_email_key243; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key243 UNIQUE (email);


--
-- Name: users users_email_key244; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key244 UNIQUE (email);


--
-- Name: users users_email_key245; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key245 UNIQUE (email);


--
-- Name: users users_email_key246; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key246 UNIQUE (email);


--
-- Name: users users_email_key247; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key247 UNIQUE (email);


--
-- Name: users users_email_key248; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key248 UNIQUE (email);


--
-- Name: users users_email_key249; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key249 UNIQUE (email);


--
-- Name: users users_email_key25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key25 UNIQUE (email);


--
-- Name: users users_email_key250; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key250 UNIQUE (email);


--
-- Name: users users_email_key251; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key251 UNIQUE (email);


--
-- Name: users users_email_key252; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key252 UNIQUE (email);


--
-- Name: users users_email_key253; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key253 UNIQUE (email);


--
-- Name: users users_email_key254; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key254 UNIQUE (email);


--
-- Name: users users_email_key255; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key255 UNIQUE (email);


--
-- Name: users users_email_key256; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key256 UNIQUE (email);


--
-- Name: users users_email_key257; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key257 UNIQUE (email);


--
-- Name: users users_email_key258; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key258 UNIQUE (email);


--
-- Name: users users_email_key259; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key259 UNIQUE (email);


--
-- Name: users users_email_key26; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key26 UNIQUE (email);


--
-- Name: users users_email_key260; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key260 UNIQUE (email);


--
-- Name: users users_email_key261; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key261 UNIQUE (email);


--
-- Name: users users_email_key262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key262 UNIQUE (email);


--
-- Name: users users_email_key263; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key263 UNIQUE (email);


--
-- Name: users users_email_key264; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key264 UNIQUE (email);


--
-- Name: users users_email_key265; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key265 UNIQUE (email);


--
-- Name: users users_email_key266; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key266 UNIQUE (email);


--
-- Name: users users_email_key267; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key267 UNIQUE (email);


--
-- Name: users users_email_key268; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key268 UNIQUE (email);


--
-- Name: users users_email_key269; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key269 UNIQUE (email);


--
-- Name: users users_email_key27; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key27 UNIQUE (email);


--
-- Name: users users_email_key270; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key270 UNIQUE (email);


--
-- Name: users users_email_key271; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key271 UNIQUE (email);


--
-- Name: users users_email_key272; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key272 UNIQUE (email);


--
-- Name: users users_email_key273; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key273 UNIQUE (email);


--
-- Name: users users_email_key274; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key274 UNIQUE (email);


--
-- Name: users users_email_key275; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key275 UNIQUE (email);


--
-- Name: users users_email_key276; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key276 UNIQUE (email);


--
-- Name: users users_email_key277; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key277 UNIQUE (email);


--
-- Name: users users_email_key278; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key278 UNIQUE (email);


--
-- Name: users users_email_key279; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key279 UNIQUE (email);


--
-- Name: users users_email_key28; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key28 UNIQUE (email);


--
-- Name: users users_email_key280; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key280 UNIQUE (email);


--
-- Name: users users_email_key281; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key281 UNIQUE (email);


--
-- Name: users users_email_key282; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key282 UNIQUE (email);


--
-- Name: users users_email_key283; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key283 UNIQUE (email);


--
-- Name: users users_email_key284; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key284 UNIQUE (email);


--
-- Name: users users_email_key285; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key285 UNIQUE (email);


--
-- Name: users users_email_key286; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key286 UNIQUE (email);


--
-- Name: users users_email_key287; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key287 UNIQUE (email);


--
-- Name: users users_email_key288; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key288 UNIQUE (email);


--
-- Name: users users_email_key289; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key289 UNIQUE (email);


--
-- Name: users users_email_key29; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key29 UNIQUE (email);


--
-- Name: users users_email_key290; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key290 UNIQUE (email);


--
-- Name: users users_email_key291; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key291 UNIQUE (email);


--
-- Name: users users_email_key292; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key292 UNIQUE (email);


--
-- Name: users users_email_key293; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key293 UNIQUE (email);


--
-- Name: users users_email_key294; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key294 UNIQUE (email);


--
-- Name: users users_email_key295; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key295 UNIQUE (email);


--
-- Name: users users_email_key296; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key296 UNIQUE (email);


--
-- Name: users users_email_key297; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key297 UNIQUE (email);


--
-- Name: users users_email_key298; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key298 UNIQUE (email);


--
-- Name: users users_email_key299; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key299 UNIQUE (email);


--
-- Name: users users_email_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key3 UNIQUE (email);


--
-- Name: users users_email_key30; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key30 UNIQUE (email);


--
-- Name: users users_email_key300; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key300 UNIQUE (email);


--
-- Name: users users_email_key301; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key301 UNIQUE (email);


--
-- Name: users users_email_key302; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key302 UNIQUE (email);


--
-- Name: users users_email_key303; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key303 UNIQUE (email);


--
-- Name: users users_email_key304; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key304 UNIQUE (email);


--
-- Name: users users_email_key305; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key305 UNIQUE (email);


--
-- Name: users users_email_key306; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key306 UNIQUE (email);


--
-- Name: users users_email_key307; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key307 UNIQUE (email);


--
-- Name: users users_email_key308; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key308 UNIQUE (email);


--
-- Name: users users_email_key309; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key309 UNIQUE (email);


--
-- Name: users users_email_key31; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key31 UNIQUE (email);


--
-- Name: users users_email_key310; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key310 UNIQUE (email);


--
-- Name: users users_email_key311; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key311 UNIQUE (email);


--
-- Name: users users_email_key312; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key312 UNIQUE (email);


--
-- Name: users users_email_key313; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key313 UNIQUE (email);


--
-- Name: users users_email_key314; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key314 UNIQUE (email);


--
-- Name: users users_email_key315; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key315 UNIQUE (email);


--
-- Name: users users_email_key316; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key316 UNIQUE (email);


--
-- Name: users users_email_key317; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key317 UNIQUE (email);


--
-- Name: users users_email_key318; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key318 UNIQUE (email);


--
-- Name: users users_email_key319; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key319 UNIQUE (email);


--
-- Name: users users_email_key32; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key32 UNIQUE (email);


--
-- Name: users users_email_key320; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key320 UNIQUE (email);


--
-- Name: users users_email_key321; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key321 UNIQUE (email);


--
-- Name: users users_email_key322; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key322 UNIQUE (email);


--
-- Name: users users_email_key323; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key323 UNIQUE (email);


--
-- Name: users users_email_key324; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key324 UNIQUE (email);


--
-- Name: users users_email_key325; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key325 UNIQUE (email);


--
-- Name: users users_email_key326; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key326 UNIQUE (email);


--
-- Name: users users_email_key327; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key327 UNIQUE (email);


--
-- Name: users users_email_key328; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key328 UNIQUE (email);


--
-- Name: users users_email_key329; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key329 UNIQUE (email);


--
-- Name: users users_email_key33; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key33 UNIQUE (email);


--
-- Name: users users_email_key330; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key330 UNIQUE (email);


--
-- Name: users users_email_key331; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key331 UNIQUE (email);


--
-- Name: users users_email_key332; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key332 UNIQUE (email);


--
-- Name: users users_email_key333; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key333 UNIQUE (email);


--
-- Name: users users_email_key334; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key334 UNIQUE (email);


--
-- Name: users users_email_key335; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key335 UNIQUE (email);


--
-- Name: users users_email_key336; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key336 UNIQUE (email);


--
-- Name: users users_email_key337; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key337 UNIQUE (email);


--
-- Name: users users_email_key338; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key338 UNIQUE (email);


--
-- Name: users users_email_key339; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key339 UNIQUE (email);


--
-- Name: users users_email_key34; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key34 UNIQUE (email);


--
-- Name: users users_email_key340; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key340 UNIQUE (email);


--
-- Name: users users_email_key341; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key341 UNIQUE (email);


--
-- Name: users users_email_key342; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key342 UNIQUE (email);


--
-- Name: users users_email_key343; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key343 UNIQUE (email);


--
-- Name: users users_email_key344; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key344 UNIQUE (email);


--
-- Name: users users_email_key345; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key345 UNIQUE (email);


--
-- Name: users users_email_key346; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key346 UNIQUE (email);


--
-- Name: users users_email_key347; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key347 UNIQUE (email);


--
-- Name: users users_email_key348; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key348 UNIQUE (email);


--
-- Name: users users_email_key349; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key349 UNIQUE (email);


--
-- Name: users users_email_key35; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key35 UNIQUE (email);


--
-- Name: users users_email_key350; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key350 UNIQUE (email);


--
-- Name: users users_email_key351; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key351 UNIQUE (email);


--
-- Name: users users_email_key352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key352 UNIQUE (email);


--
-- Name: users users_email_key353; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key353 UNIQUE (email);


--
-- Name: users users_email_key354; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key354 UNIQUE (email);


--
-- Name: users users_email_key355; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key355 UNIQUE (email);


--
-- Name: users users_email_key356; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key356 UNIQUE (email);


--
-- Name: users users_email_key357; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key357 UNIQUE (email);


--
-- Name: users users_email_key358; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key358 UNIQUE (email);


--
-- Name: users users_email_key359; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key359 UNIQUE (email);


--
-- Name: users users_email_key36; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key36 UNIQUE (email);


--
-- Name: users users_email_key360; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key360 UNIQUE (email);


--
-- Name: users users_email_key361; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key361 UNIQUE (email);


--
-- Name: users users_email_key362; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key362 UNIQUE (email);


--
-- Name: users users_email_key363; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key363 UNIQUE (email);


--
-- Name: users users_email_key364; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key364 UNIQUE (email);


--
-- Name: users users_email_key365; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key365 UNIQUE (email);


--
-- Name: users users_email_key366; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key366 UNIQUE (email);


--
-- Name: users users_email_key367; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key367 UNIQUE (email);


--
-- Name: users users_email_key368; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key368 UNIQUE (email);


--
-- Name: users users_email_key369; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key369 UNIQUE (email);


--
-- Name: users users_email_key37; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key37 UNIQUE (email);


--
-- Name: users users_email_key370; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key370 UNIQUE (email);


--
-- Name: users users_email_key371; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key371 UNIQUE (email);


--
-- Name: users users_email_key372; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key372 UNIQUE (email);


--
-- Name: users users_email_key373; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key373 UNIQUE (email);


--
-- Name: users users_email_key374; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key374 UNIQUE (email);


--
-- Name: users users_email_key375; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key375 UNIQUE (email);


--
-- Name: users users_email_key376; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key376 UNIQUE (email);


--
-- Name: users users_email_key377; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key377 UNIQUE (email);


--
-- Name: users users_email_key378; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key378 UNIQUE (email);


--
-- Name: users users_email_key379; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key379 UNIQUE (email);


--
-- Name: users users_email_key38; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key38 UNIQUE (email);


--
-- Name: users users_email_key380; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key380 UNIQUE (email);


--
-- Name: users users_email_key381; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key381 UNIQUE (email);


--
-- Name: users users_email_key382; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key382 UNIQUE (email);


--
-- Name: users users_email_key383; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key383 UNIQUE (email);


--
-- Name: users users_email_key384; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key384 UNIQUE (email);


--
-- Name: users users_email_key385; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key385 UNIQUE (email);


--
-- Name: users users_email_key386; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key386 UNIQUE (email);


--
-- Name: users users_email_key387; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key387 UNIQUE (email);


--
-- Name: users users_email_key388; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key388 UNIQUE (email);


--
-- Name: users users_email_key389; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key389 UNIQUE (email);


--
-- Name: users users_email_key39; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key39 UNIQUE (email);


--
-- Name: users users_email_key390; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key390 UNIQUE (email);


--
-- Name: users users_email_key391; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key391 UNIQUE (email);


--
-- Name: users users_email_key392; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key392 UNIQUE (email);


--
-- Name: users users_email_key393; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key393 UNIQUE (email);


--
-- Name: users users_email_key394; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key394 UNIQUE (email);


--
-- Name: users users_email_key395; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key395 UNIQUE (email);


--
-- Name: users users_email_key396; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key396 UNIQUE (email);


--
-- Name: users users_email_key397; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key397 UNIQUE (email);


--
-- Name: users users_email_key398; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key398 UNIQUE (email);


--
-- Name: users users_email_key399; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key399 UNIQUE (email);


--
-- Name: users users_email_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key4 UNIQUE (email);


--
-- Name: users users_email_key40; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key40 UNIQUE (email);


--
-- Name: users users_email_key400; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key400 UNIQUE (email);


--
-- Name: users users_email_key401; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key401 UNIQUE (email);


--
-- Name: users users_email_key402; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key402 UNIQUE (email);


--
-- Name: users users_email_key403; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key403 UNIQUE (email);


--
-- Name: users users_email_key404; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key404 UNIQUE (email);


--
-- Name: users users_email_key405; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key405 UNIQUE (email);


--
-- Name: users users_email_key406; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key406 UNIQUE (email);


--
-- Name: users users_email_key407; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key407 UNIQUE (email);


--
-- Name: users users_email_key408; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key408 UNIQUE (email);


--
-- Name: users users_email_key409; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key409 UNIQUE (email);


--
-- Name: users users_email_key41; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key41 UNIQUE (email);


--
-- Name: users users_email_key410; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key410 UNIQUE (email);


--
-- Name: users users_email_key411; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key411 UNIQUE (email);


--
-- Name: users users_email_key412; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key412 UNIQUE (email);


--
-- Name: users users_email_key413; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key413 UNIQUE (email);


--
-- Name: users users_email_key414; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key414 UNIQUE (email);


--
-- Name: users users_email_key415; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key415 UNIQUE (email);


--
-- Name: users users_email_key416; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key416 UNIQUE (email);


--
-- Name: users users_email_key417; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key417 UNIQUE (email);


--
-- Name: users users_email_key418; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key418 UNIQUE (email);


--
-- Name: users users_email_key419; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key419 UNIQUE (email);


--
-- Name: users users_email_key42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key42 UNIQUE (email);


--
-- Name: users users_email_key420; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key420 UNIQUE (email);


--
-- Name: users users_email_key421; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key421 UNIQUE (email);


--
-- Name: users users_email_key422; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key422 UNIQUE (email);


--
-- Name: users users_email_key423; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key423 UNIQUE (email);


--
-- Name: users users_email_key424; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key424 UNIQUE (email);


--
-- Name: users users_email_key425; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key425 UNIQUE (email);


--
-- Name: users users_email_key426; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key426 UNIQUE (email);


--
-- Name: users users_email_key427; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key427 UNIQUE (email);


--
-- Name: users users_email_key428; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key428 UNIQUE (email);


--
-- Name: users users_email_key429; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key429 UNIQUE (email);


--
-- Name: users users_email_key43; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key43 UNIQUE (email);


--
-- Name: users users_email_key430; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key430 UNIQUE (email);


--
-- Name: users users_email_key431; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key431 UNIQUE (email);


--
-- Name: users users_email_key432; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key432 UNIQUE (email);


--
-- Name: users users_email_key433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key433 UNIQUE (email);


--
-- Name: users users_email_key434; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key434 UNIQUE (email);


--
-- Name: users users_email_key435; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key435 UNIQUE (email);


--
-- Name: users users_email_key436; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key436 UNIQUE (email);


--
-- Name: users users_email_key437; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key437 UNIQUE (email);


--
-- Name: users users_email_key438; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key438 UNIQUE (email);


--
-- Name: users users_email_key439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key439 UNIQUE (email);


--
-- Name: users users_email_key44; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key44 UNIQUE (email);


--
-- Name: users users_email_key440; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key440 UNIQUE (email);


--
-- Name: users users_email_key441; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key441 UNIQUE (email);


--
-- Name: users users_email_key442; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key442 UNIQUE (email);


--
-- Name: users users_email_key443; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key443 UNIQUE (email);


--
-- Name: users users_email_key444; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key444 UNIQUE (email);


--
-- Name: users users_email_key445; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key445 UNIQUE (email);


--
-- Name: users users_email_key446; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key446 UNIQUE (email);


--
-- Name: users users_email_key447; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key447 UNIQUE (email);


--
-- Name: users users_email_key448; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key448 UNIQUE (email);


--
-- Name: users users_email_key449; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key449 UNIQUE (email);


--
-- Name: users users_email_key45; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key45 UNIQUE (email);


--
-- Name: users users_email_key450; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key450 UNIQUE (email);


--
-- Name: users users_email_key451; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key451 UNIQUE (email);


--
-- Name: users users_email_key452; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key452 UNIQUE (email);


--
-- Name: users users_email_key453; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key453 UNIQUE (email);


--
-- Name: users users_email_key454; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key454 UNIQUE (email);


--
-- Name: users users_email_key455; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key455 UNIQUE (email);


--
-- Name: users users_email_key456; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key456 UNIQUE (email);


--
-- Name: users users_email_key457; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key457 UNIQUE (email);


--
-- Name: users users_email_key458; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key458 UNIQUE (email);


--
-- Name: users users_email_key459; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key459 UNIQUE (email);


--
-- Name: users users_email_key46; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key46 UNIQUE (email);


--
-- Name: users users_email_key460; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key460 UNIQUE (email);


--
-- Name: users users_email_key461; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key461 UNIQUE (email);


--
-- Name: users users_email_key462; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key462 UNIQUE (email);


--
-- Name: users users_email_key463; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key463 UNIQUE (email);


--
-- Name: users users_email_key464; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key464 UNIQUE (email);


--
-- Name: users users_email_key465; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key465 UNIQUE (email);


--
-- Name: users users_email_key466; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key466 UNIQUE (email);


--
-- Name: users users_email_key467; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key467 UNIQUE (email);


--
-- Name: users users_email_key468; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key468 UNIQUE (email);


--
-- Name: users users_email_key469; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key469 UNIQUE (email);


--
-- Name: users users_email_key47; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key47 UNIQUE (email);


--
-- Name: users users_email_key470; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key470 UNIQUE (email);


--
-- Name: users users_email_key471; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key471 UNIQUE (email);


--
-- Name: users users_email_key472; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key472 UNIQUE (email);


--
-- Name: users users_email_key473; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key473 UNIQUE (email);


--
-- Name: users users_email_key474; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key474 UNIQUE (email);


--
-- Name: users users_email_key475; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key475 UNIQUE (email);


--
-- Name: users users_email_key476; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key476 UNIQUE (email);


--
-- Name: users users_email_key477; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key477 UNIQUE (email);


--
-- Name: users users_email_key478; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key478 UNIQUE (email);


--
-- Name: users users_email_key479; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key479 UNIQUE (email);


--
-- Name: users users_email_key48; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key48 UNIQUE (email);


--
-- Name: users users_email_key480; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key480 UNIQUE (email);


--
-- Name: users users_email_key481; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key481 UNIQUE (email);


--
-- Name: users users_email_key482; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key482 UNIQUE (email);


--
-- Name: users users_email_key483; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key483 UNIQUE (email);


--
-- Name: users users_email_key484; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key484 UNIQUE (email);


--
-- Name: users users_email_key485; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key485 UNIQUE (email);


--
-- Name: users users_email_key486; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key486 UNIQUE (email);


--
-- Name: users users_email_key487; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key487 UNIQUE (email);


--
-- Name: users users_email_key488; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key488 UNIQUE (email);


--
-- Name: users users_email_key489; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key489 UNIQUE (email);


--
-- Name: users users_email_key49; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key49 UNIQUE (email);


--
-- Name: users users_email_key490; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key490 UNIQUE (email);


--
-- Name: users users_email_key491; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key491 UNIQUE (email);


--
-- Name: users users_email_key492; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key492 UNIQUE (email);


--
-- Name: users users_email_key493; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key493 UNIQUE (email);


--
-- Name: users users_email_key494; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key494 UNIQUE (email);


--
-- Name: users users_email_key495; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key495 UNIQUE (email);


--
-- Name: users users_email_key496; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key496 UNIQUE (email);


--
-- Name: users users_email_key497; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key497 UNIQUE (email);


--
-- Name: users users_email_key498; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key498 UNIQUE (email);


--
-- Name: users users_email_key499; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key499 UNIQUE (email);


--
-- Name: users users_email_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key5 UNIQUE (email);


--
-- Name: users users_email_key50; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key50 UNIQUE (email);


--
-- Name: users users_email_key500; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key500 UNIQUE (email);


--
-- Name: users users_email_key501; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key501 UNIQUE (email);


--
-- Name: users users_email_key502; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key502 UNIQUE (email);


--
-- Name: users users_email_key503; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key503 UNIQUE (email);


--
-- Name: users users_email_key504; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key504 UNIQUE (email);


--
-- Name: users users_email_key505; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key505 UNIQUE (email);


--
-- Name: users users_email_key506; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key506 UNIQUE (email);


--
-- Name: users users_email_key507; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key507 UNIQUE (email);


--
-- Name: users users_email_key508; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key508 UNIQUE (email);


--
-- Name: users users_email_key509; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key509 UNIQUE (email);


--
-- Name: users users_email_key51; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key51 UNIQUE (email);


--
-- Name: users users_email_key510; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key510 UNIQUE (email);


--
-- Name: users users_email_key511; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key511 UNIQUE (email);


--
-- Name: users users_email_key512; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key512 UNIQUE (email);


--
-- Name: users users_email_key513; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key513 UNIQUE (email);


--
-- Name: users users_email_key514; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key514 UNIQUE (email);


--
-- Name: users users_email_key515; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key515 UNIQUE (email);


--
-- Name: users users_email_key516; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key516 UNIQUE (email);


--
-- Name: users users_email_key517; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key517 UNIQUE (email);


--
-- Name: users users_email_key518; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key518 UNIQUE (email);


--
-- Name: users users_email_key519; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key519 UNIQUE (email);


--
-- Name: users users_email_key52; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key52 UNIQUE (email);


--
-- Name: users users_email_key520; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key520 UNIQUE (email);


--
-- Name: users users_email_key521; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key521 UNIQUE (email);


--
-- Name: users users_email_key522; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key522 UNIQUE (email);


--
-- Name: users users_email_key523; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key523 UNIQUE (email);


--
-- Name: users users_email_key524; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key524 UNIQUE (email);


--
-- Name: users users_email_key525; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key525 UNIQUE (email);


--
-- Name: users users_email_key526; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key526 UNIQUE (email);


--
-- Name: users users_email_key527; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key527 UNIQUE (email);


--
-- Name: users users_email_key528; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key528 UNIQUE (email);


--
-- Name: users users_email_key529; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key529 UNIQUE (email);


--
-- Name: users users_email_key53; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key53 UNIQUE (email);


--
-- Name: users users_email_key530; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key530 UNIQUE (email);


--
-- Name: users users_email_key531; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key531 UNIQUE (email);


--
-- Name: users users_email_key532; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key532 UNIQUE (email);


--
-- Name: users users_email_key533; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key533 UNIQUE (email);


--
-- Name: users users_email_key534; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key534 UNIQUE (email);


--
-- Name: users users_email_key535; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key535 UNIQUE (email);


--
-- Name: users users_email_key536; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key536 UNIQUE (email);


--
-- Name: users users_email_key537; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key537 UNIQUE (email);


--
-- Name: users users_email_key538; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key538 UNIQUE (email);


--
-- Name: users users_email_key539; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key539 UNIQUE (email);


--
-- Name: users users_email_key54; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key54 UNIQUE (email);


--
-- Name: users users_email_key540; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key540 UNIQUE (email);


--
-- Name: users users_email_key541; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key541 UNIQUE (email);


--
-- Name: users users_email_key542; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key542 UNIQUE (email);


--
-- Name: users users_email_key543; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key543 UNIQUE (email);


--
-- Name: users users_email_key544; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key544 UNIQUE (email);


--
-- Name: users users_email_key545; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key545 UNIQUE (email);


--
-- Name: users users_email_key546; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key546 UNIQUE (email);


--
-- Name: users users_email_key547; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key547 UNIQUE (email);


--
-- Name: users users_email_key548; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key548 UNIQUE (email);


--
-- Name: users users_email_key549; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key549 UNIQUE (email);


--
-- Name: users users_email_key55; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key55 UNIQUE (email);


--
-- Name: users users_email_key550; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key550 UNIQUE (email);


--
-- Name: users users_email_key551; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key551 UNIQUE (email);


--
-- Name: users users_email_key552; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key552 UNIQUE (email);


--
-- Name: users users_email_key553; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key553 UNIQUE (email);


--
-- Name: users users_email_key554; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key554 UNIQUE (email);


--
-- Name: users users_email_key555; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key555 UNIQUE (email);


--
-- Name: users users_email_key556; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key556 UNIQUE (email);


--
-- Name: users users_email_key557; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key557 UNIQUE (email);


--
-- Name: users users_email_key558; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key558 UNIQUE (email);


--
-- Name: users users_email_key559; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key559 UNIQUE (email);


--
-- Name: users users_email_key56; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key56 UNIQUE (email);


--
-- Name: users users_email_key560; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key560 UNIQUE (email);


--
-- Name: users users_email_key561; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key561 UNIQUE (email);


--
-- Name: users users_email_key562; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key562 UNIQUE (email);


--
-- Name: users users_email_key563; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key563 UNIQUE (email);


--
-- Name: users users_email_key564; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key564 UNIQUE (email);


--
-- Name: users users_email_key565; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key565 UNIQUE (email);


--
-- Name: users users_email_key566; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key566 UNIQUE (email);


--
-- Name: users users_email_key567; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key567 UNIQUE (email);


--
-- Name: users users_email_key568; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key568 UNIQUE (email);


--
-- Name: users users_email_key569; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key569 UNIQUE (email);


--
-- Name: users users_email_key57; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key57 UNIQUE (email);


--
-- Name: users users_email_key570; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key570 UNIQUE (email);


--
-- Name: users users_email_key571; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key571 UNIQUE (email);


--
-- Name: users users_email_key572; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key572 UNIQUE (email);


--
-- Name: users users_email_key573; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key573 UNIQUE (email);


--
-- Name: users users_email_key574; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key574 UNIQUE (email);


--
-- Name: users users_email_key575; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key575 UNIQUE (email);


--
-- Name: users users_email_key576; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key576 UNIQUE (email);


--
-- Name: users users_email_key577; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key577 UNIQUE (email);


--
-- Name: users users_email_key578; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key578 UNIQUE (email);


--
-- Name: users users_email_key579; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key579 UNIQUE (email);


--
-- Name: users users_email_key58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key58 UNIQUE (email);


--
-- Name: users users_email_key580; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key580 UNIQUE (email);


--
-- Name: users users_email_key581; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key581 UNIQUE (email);


--
-- Name: users users_email_key582; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key582 UNIQUE (email);


--
-- Name: users users_email_key583; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key583 UNIQUE (email);


--
-- Name: users users_email_key584; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key584 UNIQUE (email);


--
-- Name: users users_email_key585; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key585 UNIQUE (email);


--
-- Name: users users_email_key586; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key586 UNIQUE (email);


--
-- Name: users users_email_key587; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key587 UNIQUE (email);


--
-- Name: users users_email_key588; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key588 UNIQUE (email);


--
-- Name: users users_email_key589; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key589 UNIQUE (email);


--
-- Name: users users_email_key59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key59 UNIQUE (email);


--
-- Name: users users_email_key590; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key590 UNIQUE (email);


--
-- Name: users users_email_key591; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key591 UNIQUE (email);


--
-- Name: users users_email_key592; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key592 UNIQUE (email);


--
-- Name: users users_email_key593; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key593 UNIQUE (email);


--
-- Name: users users_email_key594; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key594 UNIQUE (email);


--
-- Name: users users_email_key595; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key595 UNIQUE (email);


--
-- Name: users users_email_key596; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key596 UNIQUE (email);


--
-- Name: users users_email_key597; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key597 UNIQUE (email);


--
-- Name: users users_email_key598; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key598 UNIQUE (email);


--
-- Name: users users_email_key599; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key599 UNIQUE (email);


--
-- Name: users users_email_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key6 UNIQUE (email);


--
-- Name: users users_email_key60; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key60 UNIQUE (email);


--
-- Name: users users_email_key600; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key600 UNIQUE (email);


--
-- Name: users users_email_key601; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key601 UNIQUE (email);


--
-- Name: users users_email_key602; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key602 UNIQUE (email);


--
-- Name: users users_email_key603; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key603 UNIQUE (email);


--
-- Name: users users_email_key604; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key604 UNIQUE (email);


--
-- Name: users users_email_key605; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key605 UNIQUE (email);


--
-- Name: users users_email_key606; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key606 UNIQUE (email);


--
-- Name: users users_email_key607; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key607 UNIQUE (email);


--
-- Name: users users_email_key608; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key608 UNIQUE (email);


--
-- Name: users users_email_key609; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key609 UNIQUE (email);


--
-- Name: users users_email_key61; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key61 UNIQUE (email);


--
-- Name: users users_email_key610; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key610 UNIQUE (email);


--
-- Name: users users_email_key611; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key611 UNIQUE (email);


--
-- Name: users users_email_key612; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key612 UNIQUE (email);


--
-- Name: users users_email_key613; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key613 UNIQUE (email);


--
-- Name: users users_email_key614; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key614 UNIQUE (email);


--
-- Name: users users_email_key615; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key615 UNIQUE (email);


--
-- Name: users users_email_key616; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key616 UNIQUE (email);


--
-- Name: users users_email_key617; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key617 UNIQUE (email);


--
-- Name: users users_email_key618; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key618 UNIQUE (email);


--
-- Name: users users_email_key619; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key619 UNIQUE (email);


--
-- Name: users users_email_key62; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key62 UNIQUE (email);


--
-- Name: users users_email_key620; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key620 UNIQUE (email);


--
-- Name: users users_email_key621; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key621 UNIQUE (email);


--
-- Name: users users_email_key622; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key622 UNIQUE (email);


--
-- Name: users users_email_key623; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key623 UNIQUE (email);


--
-- Name: users users_email_key624; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key624 UNIQUE (email);


--
-- Name: users users_email_key625; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key625 UNIQUE (email);


--
-- Name: users users_email_key626; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key626 UNIQUE (email);


--
-- Name: users users_email_key627; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key627 UNIQUE (email);


--
-- Name: users users_email_key628; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key628 UNIQUE (email);


--
-- Name: users users_email_key629; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key629 UNIQUE (email);


--
-- Name: users users_email_key63; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key63 UNIQUE (email);


--
-- Name: users users_email_key630; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key630 UNIQUE (email);


--
-- Name: users users_email_key631; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key631 UNIQUE (email);


--
-- Name: users users_email_key632; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key632 UNIQUE (email);


--
-- Name: users users_email_key633; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key633 UNIQUE (email);


--
-- Name: users users_email_key634; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key634 UNIQUE (email);


--
-- Name: users users_email_key635; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key635 UNIQUE (email);


--
-- Name: users users_email_key636; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key636 UNIQUE (email);


--
-- Name: users users_email_key637; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key637 UNIQUE (email);


--
-- Name: users users_email_key638; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key638 UNIQUE (email);


--
-- Name: users users_email_key639; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key639 UNIQUE (email);


--
-- Name: users users_email_key64; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key64 UNIQUE (email);


--
-- Name: users users_email_key640; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key640 UNIQUE (email);


--
-- Name: users users_email_key641; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key641 UNIQUE (email);


--
-- Name: users users_email_key642; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key642 UNIQUE (email);


--
-- Name: users users_email_key643; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key643 UNIQUE (email);


--
-- Name: users users_email_key644; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key644 UNIQUE (email);


--
-- Name: users users_email_key645; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key645 UNIQUE (email);


--
-- Name: users users_email_key646; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key646 UNIQUE (email);


--
-- Name: users users_email_key647; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key647 UNIQUE (email);


--
-- Name: users users_email_key648; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key648 UNIQUE (email);


--
-- Name: users users_email_key649; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key649 UNIQUE (email);


--
-- Name: users users_email_key65; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key65 UNIQUE (email);


--
-- Name: users users_email_key650; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key650 UNIQUE (email);


--
-- Name: users users_email_key651; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key651 UNIQUE (email);


--
-- Name: users users_email_key652; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key652 UNIQUE (email);


--
-- Name: users users_email_key653; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key653 UNIQUE (email);


--
-- Name: users users_email_key654; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key654 UNIQUE (email);


--
-- Name: users users_email_key655; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key655 UNIQUE (email);


--
-- Name: users users_email_key656; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key656 UNIQUE (email);


--
-- Name: users users_email_key657; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key657 UNIQUE (email);


--
-- Name: users users_email_key658; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key658 UNIQUE (email);


--
-- Name: users users_email_key659; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key659 UNIQUE (email);


--
-- Name: users users_email_key66; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key66 UNIQUE (email);


--
-- Name: users users_email_key660; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key660 UNIQUE (email);


--
-- Name: users users_email_key661; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key661 UNIQUE (email);


--
-- Name: users users_email_key662; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key662 UNIQUE (email);


--
-- Name: users users_email_key663; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key663 UNIQUE (email);


--
-- Name: users users_email_key664; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key664 UNIQUE (email);


--
-- Name: users users_email_key665; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key665 UNIQUE (email);


--
-- Name: users users_email_key666; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key666 UNIQUE (email);


--
-- Name: users users_email_key667; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key667 UNIQUE (email);


--
-- Name: users users_email_key668; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key668 UNIQUE (email);


--
-- Name: users users_email_key669; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key669 UNIQUE (email);


--
-- Name: users users_email_key67; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key67 UNIQUE (email);


--
-- Name: users users_email_key670; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key670 UNIQUE (email);


--
-- Name: users users_email_key671; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key671 UNIQUE (email);


--
-- Name: users users_email_key672; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key672 UNIQUE (email);


--
-- Name: users users_email_key673; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key673 UNIQUE (email);


--
-- Name: users users_email_key674; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key674 UNIQUE (email);


--
-- Name: users users_email_key675; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key675 UNIQUE (email);


--
-- Name: users users_email_key676; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key676 UNIQUE (email);


--
-- Name: users users_email_key677; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key677 UNIQUE (email);


--
-- Name: users users_email_key678; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key678 UNIQUE (email);


--
-- Name: users users_email_key679; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key679 UNIQUE (email);


--
-- Name: users users_email_key68; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key68 UNIQUE (email);


--
-- Name: users users_email_key680; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key680 UNIQUE (email);


--
-- Name: users users_email_key681; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key681 UNIQUE (email);


--
-- Name: users users_email_key682; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key682 UNIQUE (email);


--
-- Name: users users_email_key683; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key683 UNIQUE (email);


--
-- Name: users users_email_key684; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key684 UNIQUE (email);


--
-- Name: users users_email_key685; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key685 UNIQUE (email);


--
-- Name: users users_email_key686; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key686 UNIQUE (email);


--
-- Name: users users_email_key687; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key687 UNIQUE (email);


--
-- Name: users users_email_key688; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key688 UNIQUE (email);


--
-- Name: users users_email_key689; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key689 UNIQUE (email);


--
-- Name: users users_email_key69; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key69 UNIQUE (email);


--
-- Name: users users_email_key690; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key690 UNIQUE (email);


--
-- Name: users users_email_key691; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key691 UNIQUE (email);


--
-- Name: users users_email_key692; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key692 UNIQUE (email);


--
-- Name: users users_email_key693; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key693 UNIQUE (email);


--
-- Name: users users_email_key694; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key694 UNIQUE (email);


--
-- Name: users users_email_key695; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key695 UNIQUE (email);


--
-- Name: users users_email_key696; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key696 UNIQUE (email);


--
-- Name: users users_email_key697; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key697 UNIQUE (email);


--
-- Name: users users_email_key698; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key698 UNIQUE (email);


--
-- Name: users users_email_key699; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key699 UNIQUE (email);


--
-- Name: users users_email_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key7 UNIQUE (email);


--
-- Name: users users_email_key70; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key70 UNIQUE (email);


--
-- Name: users users_email_key700; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key700 UNIQUE (email);


--
-- Name: users users_email_key701; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key701 UNIQUE (email);


--
-- Name: users users_email_key702; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key702 UNIQUE (email);


--
-- Name: users users_email_key703; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key703 UNIQUE (email);


--
-- Name: users users_email_key704; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key704 UNIQUE (email);


--
-- Name: users users_email_key705; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key705 UNIQUE (email);


--
-- Name: users users_email_key706; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key706 UNIQUE (email);


--
-- Name: users users_email_key707; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key707 UNIQUE (email);


--
-- Name: users users_email_key71; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key71 UNIQUE (email);


--
-- Name: users users_email_key72; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key72 UNIQUE (email);


--
-- Name: users users_email_key73; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key73 UNIQUE (email);


--
-- Name: users users_email_key74; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key74 UNIQUE (email);


--
-- Name: users users_email_key75; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key75 UNIQUE (email);


--
-- Name: users users_email_key76; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key76 UNIQUE (email);


--
-- Name: users users_email_key77; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key77 UNIQUE (email);


--
-- Name: users users_email_key78; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key78 UNIQUE (email);


--
-- Name: users users_email_key79; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key79 UNIQUE (email);


--
-- Name: users users_email_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key8 UNIQUE (email);


--
-- Name: users users_email_key80; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key80 UNIQUE (email);


--
-- Name: users users_email_key81; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key81 UNIQUE (email);


--
-- Name: users users_email_key82; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key82 UNIQUE (email);


--
-- Name: users users_email_key83; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key83 UNIQUE (email);


--
-- Name: users users_email_key84; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key84 UNIQUE (email);


--
-- Name: users users_email_key85; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key85 UNIQUE (email);


--
-- Name: users users_email_key86; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key86 UNIQUE (email);


--
-- Name: users users_email_key87; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key87 UNIQUE (email);


--
-- Name: users users_email_key88; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key88 UNIQUE (email);


--
-- Name: users users_email_key89; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key89 UNIQUE (email);


--
-- Name: users users_email_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key9 UNIQUE (email);


--
-- Name: users users_email_key90; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key90 UNIQUE (email);


--
-- Name: users users_email_key91; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key91 UNIQUE (email);


--
-- Name: users users_email_key92; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key92 UNIQUE (email);


--
-- Name: users users_email_key93; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key93 UNIQUE (email);


--
-- Name: users users_email_key94; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key94 UNIQUE (email);


--
-- Name: users users_email_key95; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key95 UNIQUE (email);


--
-- Name: users users_email_key96; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key96 UNIQUE (email);


--
-- Name: users users_email_key97; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key97 UNIQUE (email);


--
-- Name: users users_email_key98; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key98 UNIQUE (email);


--
-- Name: users users_email_key99; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key99 UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referralCode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key1" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key10; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key10" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key100; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key100" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key101; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key101" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key102; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key102" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key103; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key103" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key104; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key104" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key105; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key105" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key106; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key106" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key107; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key107" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key108; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key108" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key109; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key109" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key11; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key11" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key110; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key110" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key111; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key111" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key112; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key112" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key113; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key113" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key114; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key114" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key115; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key115" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key116; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key116" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key117; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key117" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key118; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key118" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key119; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key119" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key12; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key12" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key120; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key120" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key121; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key121" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key122; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key122" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key123; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key123" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key124; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key124" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key125; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key125" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key126; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key126" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key127; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key127" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key128; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key128" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key129; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key129" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key13; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key13" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key130; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key130" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key131; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key131" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key132; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key132" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key133; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key133" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key134; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key134" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key135; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key135" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key136; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key136" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key137; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key137" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key138; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key138" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key139; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key139" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key14; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key14" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key140; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key140" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key141; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key141" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key142; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key142" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key143; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key143" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key144; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key144" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key145; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key145" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key146; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key146" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key147; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key147" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key148; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key148" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key149; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key149" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key15; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key15" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key150; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key150" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key151; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key151" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key152; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key152" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key153; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key153" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key154; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key154" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key155; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key155" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key156; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key156" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key157; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key157" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key158; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key158" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key159; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key159" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key16; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key16" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key160; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key160" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key161; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key161" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key162; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key162" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key163; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key163" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key164; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key164" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key165; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key165" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key166; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key166" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key167; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key167" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key168; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key168" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key169; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key169" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key17; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key17" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key170; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key170" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key171; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key171" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key172; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key172" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key173; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key173" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key174; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key174" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key175; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key175" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key176; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key176" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key177; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key177" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key178; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key178" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key179; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key179" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key18; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key18" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key180; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key180" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key181; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key181" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key182; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key182" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key183; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key183" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key184; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key184" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key185; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key185" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key186; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key186" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key187; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key187" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key188; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key188" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key189; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key189" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key19; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key19" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key190; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key190" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key191; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key191" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key192; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key192" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key193; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key193" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key194; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key194" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key195; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key195" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key196; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key196" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key197; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key197" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key198; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key198" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key199; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key199" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key2; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key2" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key20; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key20" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key200; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key200" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key201; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key201" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key202; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key202" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key203; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key203" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key204; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key204" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key205; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key205" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key206; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key206" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key207; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key207" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key208; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key208" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key209; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key209" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key21; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key21" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key210; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key210" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key211; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key211" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key212; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key212" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key213; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key213" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key214; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key214" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key215; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key215" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key216; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key216" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key217; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key217" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key218; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key218" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key219; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key219" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key22; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key22" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key220; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key220" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key221; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key221" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key222; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key222" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key223; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key223" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key224; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key224" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key225; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key225" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key226; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key226" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key227; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key227" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key228; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key228" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key229; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key229" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key23; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key23" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key230; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key230" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key231; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key231" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key232; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key232" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key233; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key233" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key234; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key234" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key235; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key235" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key236; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key236" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key237; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key237" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key238; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key238" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key239; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key239" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key24; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key24" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key240; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key240" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key241; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key241" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key242; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key242" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key243; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key243" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key244; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key244" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key245; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key245" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key246; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key246" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key247; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key247" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key248; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key248" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key249; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key249" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key25; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key25" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key250; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key250" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key251; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key251" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key252; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key252" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key253; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key253" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key254; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key254" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key255; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key255" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key256; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key256" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key257; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key257" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key258; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key258" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key259; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key259" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key26; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key26" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key260; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key260" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key261; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key261" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key262; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key262" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key263; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key263" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key264; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key264" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key265; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key265" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key266; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key266" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key267; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key267" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key268; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key268" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key269; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key269" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key27; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key27" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key270; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key270" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key271; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key271" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key272; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key272" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key273; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key273" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key274; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key274" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key275; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key275" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key276; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key276" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key277; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key277" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key278; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key278" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key279; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key279" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key28; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key28" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key280; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key280" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key281; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key281" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key282; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key282" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key283; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key283" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key284; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key284" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key285; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key285" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key286; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key286" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key287; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key287" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key288; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key288" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key289; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key289" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key29; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key29" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key290; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key290" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key291; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key291" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key292; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key292" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key293; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key293" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key294; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key294" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key295; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key295" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key296; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key296" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key297; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key297" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key298; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key298" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key299; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key299" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key3" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key30; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key30" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key300; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key300" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key301; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key301" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key302; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key302" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key303; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key303" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key304; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key304" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key305; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key305" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key306; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key306" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key307; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key307" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key308; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key308" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key309; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key309" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key31; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key31" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key310; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key310" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key311; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key311" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key312; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key312" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key313; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key313" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key314; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key314" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key315; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key315" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key316; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key316" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key317; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key317" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key318; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key318" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key319; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key319" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key32; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key32" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key320; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key320" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key321; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key321" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key322; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key322" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key323; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key323" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key324; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key324" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key325; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key325" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key326; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key326" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key327; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key327" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key328; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key328" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key329; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key329" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key33; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key33" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key330; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key330" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key331; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key331" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key332; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key332" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key333; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key333" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key334; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key334" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key335; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key335" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key336; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key336" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key337; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key337" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key338; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key338" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key339; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key339" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key34; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key34" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key340; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key340" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key341; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key341" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key342; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key342" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key343; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key343" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key344; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key344" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key345; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key345" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key346; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key346" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key347; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key347" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key348; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key348" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key349; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key349" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key35; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key35" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key350; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key350" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key351; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key351" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key352; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key352" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key353; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key353" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key354; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key354" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key355; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key355" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key356; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key356" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key357; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key357" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key358; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key358" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key359; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key359" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key36; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key36" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key360; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key360" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key361; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key361" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key362; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key362" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key363; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key363" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key364; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key364" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key365; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key365" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key366; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key366" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key367; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key367" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key368; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key368" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key369; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key369" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key37; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key37" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key370; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key370" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key371; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key371" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key372; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key372" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key373; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key373" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key374; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key374" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key375; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key375" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key376; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key376" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key377; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key377" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key378; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key378" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key379; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key379" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key38; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key38" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key380; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key380" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key381; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key381" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key382; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key382" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key383; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key383" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key384; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key384" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key385; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key385" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key386; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key386" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key387; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key387" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key388; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key388" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key389; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key389" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key39; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key39" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key390; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key390" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key391; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key391" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key392; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key392" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key393; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key393" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key394; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key394" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key395; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key395" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key396; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key396" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key397; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key397" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key398; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key398" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key399; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key399" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key4" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key40; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key40" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key400; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key400" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key401; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key401" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key402; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key402" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key403; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key403" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key404; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key404" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key405; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key405" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key406; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key406" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key407; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key407" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key408; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key408" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key409; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key409" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key41; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key41" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key410; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key410" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key411; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key411" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key412; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key412" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key413; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key413" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key414; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key414" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key415; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key415" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key416; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key416" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key417; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key417" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key418; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key418" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key419; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key419" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key42; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key42" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key420; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key420" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key421; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key421" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key422; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key422" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key423; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key423" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key424; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key424" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key425; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key425" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key426; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key426" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key427; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key427" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key428; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key428" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key429; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key429" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key43; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key43" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key430; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key430" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key431; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key431" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key432; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key432" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key433; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key433" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key434; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key434" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key435; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key435" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key436; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key436" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key437; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key437" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key438; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key438" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key439; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key439" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key44; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key44" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key440; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key440" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key441; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key441" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key442; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key442" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key443; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key443" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key444; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key444" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key445; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key445" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key446; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key446" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key447; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key447" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key448; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key448" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key449; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key449" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key45; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key45" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key450; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key450" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key451; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key451" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key452; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key452" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key453; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key453" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key454; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key454" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key455; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key455" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key456; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key456" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key457; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key457" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key458; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key458" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key459; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key459" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key46; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key46" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key460; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key460" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key461; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key461" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key462; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key462" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key463; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key463" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key464; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key464" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key465; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key465" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key466; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key466" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key467; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key467" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key468; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key468" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key469; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key469" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key47; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key47" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key470; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key470" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key471; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key471" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key472; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key472" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key473; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key473" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key474; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key474" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key475; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key475" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key476; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key476" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key477; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key477" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key478; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key478" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key479; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key479" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key48; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key48" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key480; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key480" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key481; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key481" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key482; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key482" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key483; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key483" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key484; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key484" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key485; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key485" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key486; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key486" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key487; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key487" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key488; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key488" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key489; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key489" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key49; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key49" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key490; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key490" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key491; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key491" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key492; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key492" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key493; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key493" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key494; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key494" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key495; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key495" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key496; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key496" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key497; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key497" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key498; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key498" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key499; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key499" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key5; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key5" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key50; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key50" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key500; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key500" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key501; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key501" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key502; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key502" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key503; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key503" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key504; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key504" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key505; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key505" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key506; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key506" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key507; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key507" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key508; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key508" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key509; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key509" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key51; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key51" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key510; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key510" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key511; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key511" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key512; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key512" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key513; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key513" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key514; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key514" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key515; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key515" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key516; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key516" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key517; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key517" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key518; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key518" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key519; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key519" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key52; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key52" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key520; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key520" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key521; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key521" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key522; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key522" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key523; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key523" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key524; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key524" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key525; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key525" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key526; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key526" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key527; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key527" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key528; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key528" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key529; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key529" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key53; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key53" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key530; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key530" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key531; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key531" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key532; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key532" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key533; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key533" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key534; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key534" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key535; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key535" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key536; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key536" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key537; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key537" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key538; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key538" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key539; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key539" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key54; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key54" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key540; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key540" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key541; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key541" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key542; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key542" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key543; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key543" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key544; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key544" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key545; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key545" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key546; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key546" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key547; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key547" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key548; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key548" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key549; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key549" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key55; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key55" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key550; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key550" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key551; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key551" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key552; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key552" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key553; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key553" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key554; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key554" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key555; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key555" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key556; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key556" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key557; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key557" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key558; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key558" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key559; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key559" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key56; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key56" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key560; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key560" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key561; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key561" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key562; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key562" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key563; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key563" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key564; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key564" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key565; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key565" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key566; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key566" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key567; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key567" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key568; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key568" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key569; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key569" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key57; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key57" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key570; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key570" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key571; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key571" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key572; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key572" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key573; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key573" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key574; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key574" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key575; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key575" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key576; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key576" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key577; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key577" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key578; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key578" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key579; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key579" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key58; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key58" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key580; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key580" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key581; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key581" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key582; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key582" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key583; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key583" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key584; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key584" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key585; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key585" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key586; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key586" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key587; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key587" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key588; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key588" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key589; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key589" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key59; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key59" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key590; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key590" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key591; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key591" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key592; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key592" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key593; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key593" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key594; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key594" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key595; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key595" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key596; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key596" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key597; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key597" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key598; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key598" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key599; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key599" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key6" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key60; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key60" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key600; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key600" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key601; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key601" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key602; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key602" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key603; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key603" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key604; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key604" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key605; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key605" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key606; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key606" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key607; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key607" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key608; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key608" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key609; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key609" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key61; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key61" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key610; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key610" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key611; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key611" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key612; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key612" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key613; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key613" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key614; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key614" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key615; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key615" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key616; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key616" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key617; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key617" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key618; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key618" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key619; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key619" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key62; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key62" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key620; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key620" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key621; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key621" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key622; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key622" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key623; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key623" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key624; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key624" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key625; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key625" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key626; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key626" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key627; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key627" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key628; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key628" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key629; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key629" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key63; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key63" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key630; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key630" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key631; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key631" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key632; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key632" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key633; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key633" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key634; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key634" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key635; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key635" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key636; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key636" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key637; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key637" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key638; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key638" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key639; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key639" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key64; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key64" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key640; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key640" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key641; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key641" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key642; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key642" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key643; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key643" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key644; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key644" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key645; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key645" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key646; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key646" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key647; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key647" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key648; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key648" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key649; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key649" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key65; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key65" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key650; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key650" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key651; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key651" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key652; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key652" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key653; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key653" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key654; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key654" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key655; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key655" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key656; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key656" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key657; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key657" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key658; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key658" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key659; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key659" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key66; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key66" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key660; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key660" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key661; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key661" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key662; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key662" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key663; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key663" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key664; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key664" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key665; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key665" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key666; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key666" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key67; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key67" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key68; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key68" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key69; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key69" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key7" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key70; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key70" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key71; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key71" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key72; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key72" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key73; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key73" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key74; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key74" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key75; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key75" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key76; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key76" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key77; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key77" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key78; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key78" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key79; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key79" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key8" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key80; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key80" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key81; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key81" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key82; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key82" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key83; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key83" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key84; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key84" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key85; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key85" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key86; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key86" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key87; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key87" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key88; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key88" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key89; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key89" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key9" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key90; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key90" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key91; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key91" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key92; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key92" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key93; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key93" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key94; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key94" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key95; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key95" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key96; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key96" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key97; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key97" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key98; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key98" UNIQUE ("referralCode");


--
-- Name: users users_referralCode_key99; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_referralCode_key99" UNIQUE ("referralCode");


--
-- Name: idx_bid_ask_equiti_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_equiti_symbol_timestamp ON public.bid_ask_equiti USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_exness_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_exness_symbol_timestamp ON public.bid_ask_exness USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_icmarkets_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_icmarkets_symbol_timestamp ON public.bid_ask_icmarkets USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_mhmarket_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_mhmarket_symbol_timestamp ON public.bid_ask_mhmarket USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_octafx_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_octafx_symbol_timestamp ON public.bid_ask_octafx USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_vpfx_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_vpfx_symbol_timestamp ON public.bid_ask_vpfx USING btree (symbol, "timestamp");


--
-- Name: idx_bid_ask_xm_symbol_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_ask_xm_symbol_timestamp ON public.bid_ask_xm USING btree (symbol, "timestamp");


--
-- Name: idx_broker_mappings_normalized; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_mappings_normalized ON public.broker_mappings USING btree (normalized_name);


--
-- Name: idx_broker_mappings_user_input; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_mappings_user_input ON public.broker_mappings USING btree (user_input);


--
-- Name: idx_broker_symbols_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_symbols_expires ON public.broker_symbols_cache USING btree (expires_at);


--
-- Name: idx_broker_symbols_normalized_terminal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_broker_symbols_normalized_terminal ON public.broker_symbols_cache USING btree (normalized_broker_name, terminal);


--
-- Name: idx_premium_equiti_exness_gcq5_vs_xauusdm_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_equiti_exness_gcq5_vs_xauusdm_account_timestamp ON public.premium_equiti_exness_gcq5_vs_xauusdm USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_equiti_icmarkets_gcq5_vs_xauusd_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_equiti_icmarkets_gcq5_vs_xauusd_account_timestamp ON public.premium_equiti_icmarkets_gcq5_vs_xauusd USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_equiti_xm_gcq5_vs_gold__account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_equiti_xm_gcq5_vs_gold__account_timestamp ON public.premium_equiti_xm_gcq5_vs_gold_ USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_equiti_xm_gcq5_vs_gold_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_equiti_xm_gcq5_vs_gold_account_timestamp ON public.premium_equiti_xm_gcq5_vs_gold USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_equiti_xm_gcz5_vs_gold__account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_equiti_xm_gcz5_vs_gold__account_timestamp ON public.premium_equiti_xm_gcz5_vs_gold_ USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_icmarkets_exness_gcq25_vs_xauusdm_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_icmarkets_exness_gcq25_vs_xauusdm_account_timestamp ON public.premium_icmarkets_exness_gcq25_vs_xauusdm USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_icmarkets_exness_gcz25_vs_xauusdm_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_icmarkets_exness_gcz25_vs_xauusdm_account_timestamp ON public.premium_icmarkets_exness_gcz25_vs_xauusdm USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_icmarkets_mhmarket_gcz25_vs_xauusd_account_timestam; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_icmarkets_mhmarket_gcz25_vs_xauusd_account_timestam ON public.premium_icmarkets_mhmarket_gcz25_vs_xauusd USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_vpfx_octafx_gc_q25_vs_xauusd_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_vpfx_octafx_gc_q25_vs_xauusd_account_timestamp ON public.premium_vpfx_octafx_gc_q25_vs_xauusd USING btree (account_set_id, "timestamp");


--
-- Name: idx_premium_vpfx_octafx_gc_z25_vs_xauusd_account_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_premium_vpfx_octafx_gc_z25_vs_xauusd_account_timestamp ON public.premium_vpfx_octafx_gc_z25_vs_xauusd USING btree (account_set_id, "timestamp");


--
-- Name: otps_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX otps_expires_at_idx ON public.otps USING btree ("expiresAt");


--
-- Name: account_sets account_sets_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_sets
    ADD CONSTRAINT "account_sets_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: brokers brokers_accountSetId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brokers
    ADD CONSTRAINT "brokers_accountSetId_fkey" FOREIGN KEY ("accountSetId") REFERENCES public.account_sets(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_sponsorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

