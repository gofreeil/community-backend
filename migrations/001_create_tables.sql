-- Migration 001: Create all application tables
-- Run this ONCE on a fresh PostgreSQL database before starting Strapi

-- community_users
CREATE TABLE IF NOT EXISTS community_users (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    external_id VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    avatar_url TEXT,
    provider VARCHAR(255),
    password_hash VARCHAR(255),
    nickname VARCHAR(255),
    business VARCHAR(255),
    notifications BOOLEAN DEFAULT FALSE,
    family_status VARCHAR(255),
    gender VARCHAR(255),
    birth_date VARCHAR(255),
    balance DECIMAL(10,2) DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- items
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    label TEXT,
    description TEXT,
    category VARCHAR(255),
    contact VARCHAR(255),
    phone VARCHAR(255),
    address VARCHAR(255),
    icon VARCHAR(255),
    color VARCHAR(255),
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    extra_fields JSONB,
    status1 VARCHAR(255) DEFAULT 'active',
    user_id VARCHAR(255),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- advertisements
CREATE TABLE IF NOT EXISTS advertisements (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    title VARCHAR(255),
    description TEXT,
    cta VARCHAR(255),
    href VARCHAR(255),
    color VARCHAR(255),
    item1_status VARCHAR(255) DEFAULT 'active',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- advertisement_orders
CREATE TABLE IF NOT EXISTS advertisement_orders (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    neighborhood_label VARCHAR(255),
    neighborhood_count INTEGER,
    total_payment DECIMAL(10,2),
    total_monthly DECIMAL(10,2),
    selected_items JSONB,
    item3_status VARCHAR(255) DEFAULT 'pending',
    fund_contribution DECIMAL(10,2),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- cities
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    neighborhoods JSONB,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- community_funds
CREATE TABLE IF NOT EXISTS community_funds (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2),
    source VARCHAR(255),
    note TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- profiles
CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    user_id VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(255),
    neighborhood VARCHAR(255),
    city VARCHAR(255),
    nickname VARCHAR(255),
    business VARCHAR(255),
    family_status VARCHAR(255),
    avatar_url TEXT,
    notifications INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- news_ticker_items
CREATE TABLE IF NOT EXISTS news_ticker_items (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    text VARCHAR(255),
    locale2 VARCHAR(255),
    active BOOLEAN DEFAULT TRUE,
    "order" INTEGER DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);

-- lost_found_requests
CREATE TABLE IF NOT EXISTS lost_found_requests (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE,
    type VARCHAR(255),
    description TEXT,
    contact_phone VARCHAR(255),
    neighborhood VARCHAR(255),
    item7_status VARCHAR(255) DEFAULT 'open',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id INTEGER,
    updated_by_id INTEGER,
    locale VARCHAR(255)
);
