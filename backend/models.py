from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Settings stored as JSON for frontend flexibility
    settings = Column(JSON, nullable=True)  # theme, timezone, reward_units, etc.
    
    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    checks = relationship("Check", back_populates="user", cascade="all, delete-orphan")
    counts = relationship("Count", back_populates="user", cascade="all, delete-orphan")
    weight_updates = relationship("WeightUpdate", back_populates="user", cascade="all, delete-orphan")
    active_days = relationship("ActiveDay", back_populates="user", cascade="all, delete-orphan")


class Habit(Base):
    __tablename__ = "habits"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    # Habit type flags
    has_counts = Column(Boolean, default=False)
    is_weight = Column(Boolean, default=False)
    
    # Count-specific settings (stored as JSON for frontend flexibility)
    count_settings = Column(JSON, nullable=True)  # target, unit, step_size, count_is_good, etc.
    
    # Weight-specific settings
    weight_settings = Column(JSON, nullable=True)  # target_weight, unit, etc.
    
    # Scheduling settings (all handled by frontend)
    schedule_settings = Column(JSON, nullable=True)  # weekdays, interval, display_rules, etc.
    
    # Reward settings
    reward_settings = Column(JSON, nullable=True)  # success_points, penalty_points, etc.
    
    # Display settings
    display_settings = Column(JSON, nullable=True)  # order, hidden, color, etc.
    
    # Soft deletion
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="habits")
    sub_habits = relationship("SubHabit", back_populates="parent_habit", cascade="all, delete-orphan")
    checks = relationship("Check", back_populates="habit", cascade="all, delete-orphan")
    counts = relationship("Count", back_populates="habit", cascade="all, delete-orphan")
    weight_updates = relationship("WeightUpdate", back_populates="habit", cascade="all, delete-orphan")


class SubHabit(Base):
    __tablename__ = "sub_habits"
    id = Column(Integer, primary_key=True, index=True)
    parent_habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    
    # Reward settings for individual sub-habits
    reward_settings = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    parent_habit = relationship("Habit", back_populates="sub_habits")
    checks = relationship("Check", back_populates="sub_habit", cascade="all, delete-orphan")


class Check(Base):
    __tablename__ = "checks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=True, index=True)
    sub_habit_id = Column(Integer, ForeignKey("sub_habits.id"), nullable=True, index=True)
    
    checked = Column(Boolean, default=True)
    check_date = Column(DateTime(timezone=True), nullable=False)
    
    # Store any metadata for frontend use
    metadata_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="checks")
    habit = relationship("Habit", back_populates="checks")
    sub_habit = relationship("SubHabit", back_populates="checks")


class Count(Base):
    __tablename__ = "counts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    
    value = Column(Float, nullable=False)
    count_date = Column(DateTime(timezone=True), nullable=False)
    
    # Store any metadata for frontend use
    metadata_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="counts")
    habit = relationship("Habit", back_populates="counts")


class WeightUpdate(Base):
    __tablename__ = "weight_updates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False, index=True)
    
    weight = Column(Float, nullable=False)
    update_date = Column(DateTime(timezone=True), nullable=False)
    
    # Store any metadata for frontend use
    metadata_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="weight_updates")
    habit = relationship("Habit", back_populates="weight_updates")


class ActiveDay(Base):
    __tablename__ = "active_days"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    date = Column(DateTime(timezone=True), nullable=False)
    validated = Column(Boolean, default=False)
    
    # Store day summary data for frontend use
    summary_data = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", back_populates="active_days")


# Legacy models (keep for backwards compatibility)
class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    email = Column(String, nullable=True)
    image_url = Column(String, nullable=True)


class Nugget(Base):
    __tablename__ = "nugget"
    id = Column(Integer, primary_key=True, index=True)
    text = Column(String, nullable=False)
