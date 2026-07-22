#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetailView {
    TeamAgent,
    FocusedBuddy,
    TaskRoom,
    RuntimeSetup,
    Updates,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViewMode {
    Dashboard,
    TeamMemberWorkspace,
    FocusedBuddyWorkspace,
    TaskRoomWorkspace,
    TaskRoomForm,
    HandoffForm,
    StructuredQuestion,
    CommandPalette,
    TraceDrawer,
    ActionProgress,
    ConfirmAction,
    Detail(DetailView),
    Search,
    Help,
}
