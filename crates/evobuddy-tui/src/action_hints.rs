use crate::app::WorkbenchApp;
use crate::model::ActionAvailability;
use crate::views::ViewMode;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionHint {
    pub key: &'static str,
    pub label: String,
    pub enabled: bool,
    pub disabled_reason: Option<String>,
}

pub fn action_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    match &app.view_mode {
        ViewMode::TaskRoomForm | ViewMode::HandoffForm => vec![
            hint("Enter", "Send", true, None),
            hint("Esc", "Cancel", true, None),
        ],
        ViewMode::StructuredQuestion => vec![
            hint("Enter", "Confirm", true, None),
            hint("1-9", "Choose", true, None),
            hint("Esc", "Cancel", true, None),
        ],
        ViewMode::TaskRoomWorkspace => task_room_workspace_hints(app),
        ViewMode::TeamMemberWorkspace | ViewMode::FocusedBuddyWorkspace => agent_detail_hints(app),
        ViewMode::Search => vec![
            hint("Enter", "Open", true, None),
            hint("Esc", "Back", true, None),
            hint("/", "Search", true, None),
        ],
        ViewMode::CommandPalette => vec![
            hint("Enter", "Run", true, None),
            hint("Esc", "Back", true, None),
        ],
        ViewMode::Detail(crate::views::DetailView::TaskRoom) => vec![
            hint("Enter", "Send", true, None),
            hint("^A", "Attach", true, None),
            hint("Esc", "Back", true, None),
        ],
        ViewMode::Help
        | ViewMode::TraceDrawer
        | ViewMode::Detail(_)
        | ViewMode::ActionProgress
        | ViewMode::ConfirmAction => {
            vec![
                hint("Esc", "Back/Cancel", true, None),
                hint("?", "Help", true, None),
            ]
        }
        ViewMode::Dashboard => dashboard_hints(app),
    }
}

pub fn short_primary_action_label(action: &ActionAvailability) -> String {
    match action.id.as_str() {
        "open-native-runtime" | "open-session" => "Attach".to_string(),
        "resume-conversation" | "heuristic-resume" => "Resume".to_string(),
        "continue-with-taskroom-context" => "Continue".to_string(),
        "start-new-session" => "Start new".to_string(),
        _ if action.label.eq_ignore_ascii_case("open native runtime") => "Attach".to_string(),
        _ => action.label.clone(),
    }
}

fn dashboard_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    let multi_seat = app
        .selected_task_room()
        .map(|room| room.participants.len() > 1)
        .unwrap_or(false);
    let has_room = app.selected_task_room().is_some();
    let mut hints = vec![
        hint(
            "Enter",
            if has_room { "Open" } else { "Open" }.to_string(),
            has_room,
            if has_room {
                None
            } else {
                Some("No room selected".to_string())
            },
        ),
        hint("n", "New room", true, None),
    ];
    if multi_seat {
        hints.push(hint("m", "Choose seat", true, None));
    } else {
        hints.push(hint("a", "Attach", has_room, None));
    }
    hints.push(hint("?", "Help", true, None));
    hints
}

fn task_room_workspace_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    vec![
        open_hint(app),
        hint("h", "Handoff", true, None),
        hint("e", "Evidence", true, None),
        hint("r", "Trace", true, None),
        hint("Esc", "Back", true, None),
    ]
}

fn agent_detail_hints(app: &WorkbenchApp) -> Vec<ActionHint> {
    let open = open_hint(app);
    vec![
        open,
        hint("c", "Continue with context", true, None),
        ActionHint {
            key: "x",
            label: "Stop".to_string(),
            enabled: false,
            disabled_reason: Some(
                "stop confirms process/session only; code review stays agent-owned".to_string(),
            ),
        },
        hint("Esc", "Back", true, None),
    ]
}

fn open_hint(app: &WorkbenchApp) -> ActionHint {
    match app.selected_task_room() {
        Some(room) => {
            if let Some(action) = room.available_actions.iter().find(|a| a.enabled) {
                hint("Enter", short_primary_action_label(action), true, None)
            } else if let Some(action) = room.available_actions.first() {
                ActionHint {
                    key: "Enter",
                    label: short_primary_action_label(action),
                    enabled: false,
                    disabled_reason: action.disabled_reason.clone(),
                }
            } else {
                ActionHint {
                    key: "Enter",
                    label: "Attach".to_string(),
                    enabled: false,
                    disabled_reason: Some("no runtime action available".to_string()),
                }
            }
        }
        None => ActionHint {
            key: "Enter",
            label: "Attach".to_string(),
            enabled: false,
            disabled_reason: Some("no TaskRoom selected".to_string()),
        },
    }
}

fn hint(
    key: &'static str,
    label: impl Into<String>,
    enabled: bool,
    disabled_reason: Option<String>,
) -> ActionHint {
    ActionHint {
        key,
        label: label.into(),
        enabled,
        disabled_reason,
    }
}
