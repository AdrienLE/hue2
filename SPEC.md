# Habit Tracker Application Specification

## Overview

The Habit Tracker is a web and mobile application that helps users track daily habits with a reward system. Users can create different types of habits, check them off daily, and earn points for completion.

## Core Features

### Habit Types

**Simple Habits**
- Basic checkable habits (e.g., "Drink 8 glasses of water")
- Daily check/uncheck functionality
- Customizable rewards and penalties

**Count-based Habits**
- Habits with numeric targets (e.g., "Do 50 pushups")
- Increment/decrement counters
- Target evaluation (above/below target goals)
- Custom units and step sizes

**Weight Tracking**
- Track weight with target goals
- Progress-based rewards
- Custom weight units

**Sub-habits**
- Break habits into smaller tasks
- Parent habit success depends on sub-habit completion
- Individual rewards for each sub-habit

### Scheduling & Display

**Smart Scheduling**
- Habits can be limited to specific weekdays
- Interval-based display (every N days)
- Configurable display periods
- Re-display based on time since last success

**Visibility Controls**
- Hide/unhide habits manually
- Show only unchecked habits option
- Habit reordering with drag & drop

### Reward System

**Point-based Rewards**
- Earn points for completing habits
- Penalties for missing habits
- Customizable reward amounts per habit
- Spending system for earned points
- Custom reward units (points, coins, etc.)

### User Management

**Settings**
- Dark/light/system theme
- Timezone configuration
- Custom reward units
- Debug options for testing

**Daily Validation**
- End-of-day confirmation system
- Automatic penalties for incomplete days
- Progress tracking across days

### Mobile Features

**iOS Widgets**
- Quick habit checking from home screen
- Multiple widget sizes
- Real-time sync with main app

**Native Mobile UI**
- Pull-to-refresh
- Drag & drop reordering
- Touch-optimized interfaces

## Implementation Plan

### Phase 1: Backend API (FastAPI)

**Core Setup**
- FastAPI with PostgreSQL database
- JWT authentication
- User registration/login
- Database models for all entities

**Habit Management**
- CRUD operations for all habit types
- Check/uncheck endpoints
- Count increment/decrement
- Weight update tracking
- Sub-habit management

**User Features**
- Settings management
- Reward system
- Daily validation system
- Timezone handling

### Phase 2: Web Frontend (React + TypeScript)

**Authentication**
- Login/register forms
- JWT token management
- Protected routes

**Habit Interface**
- Habit list with filtering
- Create/edit habit forms
- Check/uncheck with real-time updates
- Count and weight tracking interfaces
- Drag & drop reordering

**User Experience**
- Settings panel
- Theme switching
- Habit history viewer
- Reward spending interface

### Phase 3: Mobile App (React Native + Expo)

**Core Mobile App**
- Native authentication
- Touch-optimized habit interface
- Pull-to-refresh and native gestures
- Offline support with sync

**iOS Widgets**
- Widget extension with WidgetKit
- Interactive widgets for habit checking
- App Groups for data sharing
- Multiple widget configurations

**Mobile-Specific Features**
- Local notifications
- Haptic feedback
- Background app state management

### Phase 4: Deployment

**Backend**
- Docker containerization
- Cloud deployment (Railway/Fly.io)
- Database setup and backups
- CI/CD pipeline

**Frontend**
- Static site hosting (Vercel/Netlify)
- Environment configuration
- Automatic deployments

**Mobile**
- Expo Application Services (EAS)
- App store deployment
- Over-the-air updates

## Data Models

**User**
- Authentication and profile information
- Settings (theme, timezone, rewards)

**Habit**
- Name, scheduling rules, reward amounts
- Type flags (has_counts, is_weight)
- Display configuration
- Soft deletion support

**SubHabit**
- Parent habit relationship
- Name and ordering

**Check/Count/WeightUpdate**
- User actions with timestamps
- Reward amounts
- Success tracking

**ActiveDay**
- Daily validation tracking
- User timezone handling

This specification provides a complete blueprint for building a modern habit tracking application with web and mobile interfaces, maintaining all the sophisticated features of the original while using current technologies.