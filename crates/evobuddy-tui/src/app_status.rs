use crate::model::{
    ActorStatus, FocusedBuddy, RuntimeSetupStatus, TaskRoom, TaskRoomStatus, TeamAgent,
};

pub(crate) fn sort_by_status<T: HasStatus>(mut items: Vec<T>) -> Vec<T> {
    items.sort_by_key(|item| item.status_order());
    items
}

pub trait HasStatus {
    fn status_order(&self) -> usize;
}

impl ActorStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            ActorStatus::NeedsInput => "Needs input",
            ActorStatus::Blocked => "Blocked",
            ActorStatus::Working => "Working",
            ActorStatus::Returned => "Returned",
            ActorStatus::Available => "Available",
            ActorStatus::Archived => "Archived",
            ActorStatus::Unknown => "Unknown",
        }
    }

    pub fn order(&self) -> usize {
        match self {
            ActorStatus::NeedsInput => 0,
            ActorStatus::Blocked => 1,
            ActorStatus::Working => 2,
            ActorStatus::Returned => 3,
            ActorStatus::Available => 4,
            ActorStatus::Archived => 5,
            ActorStatus::Unknown => 6,
        }
    }
}

impl RuntimeSetupStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            RuntimeSetupStatus::Ready => "Ready",
            RuntimeSetupStatus::Partial => "Partial",
            RuntimeSetupStatus::Blocked => "Blocked",
            RuntimeSetupStatus::Working => "Working",
            RuntimeSetupStatus::Returned => "Returned",
            RuntimeSetupStatus::Available => "Available",
            RuntimeSetupStatus::Archived => "Archived",
            RuntimeSetupStatus::Unknown => "Unknown",
        }
    }
}

impl TaskRoomStatus {
    pub fn as_label(&self) -> &'static str {
        match self {
            TaskRoomStatus::Queued => "Queued",
            TaskRoomStatus::Working => "Working",
            TaskRoomStatus::NeedsInput => "Needs input",
            TaskRoomStatus::NeedsReview => "Needs review",
            TaskRoomStatus::Blocked => "Blocked",
            TaskRoomStatus::Returned => "Returned",
            TaskRoomStatus::Completed => "Completed",
            TaskRoomStatus::Failed => "Failed",
            TaskRoomStatus::Archived => "Archived",
            TaskRoomStatus::Unknown => "Unknown",
        }
    }

    pub fn order(&self) -> usize {
        match self {
            TaskRoomStatus::NeedsInput => 0,
            TaskRoomStatus::NeedsReview => 1,
            TaskRoomStatus::Blocked => 2,
            TaskRoomStatus::Working => 3,
            TaskRoomStatus::Queued => 4,
            TaskRoomStatus::Returned => 5,
            TaskRoomStatus::Completed => 6,
            TaskRoomStatus::Failed => 7,
            TaskRoomStatus::Archived => 8,
            TaskRoomStatus::Unknown => 9,
        }
    }
}

impl HasStatus for &TeamAgent {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}

impl HasStatus for &FocusedBuddy {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}

impl HasStatus for &TaskRoom {
    fn status_order(&self) -> usize {
        self.status.order()
    }
}
