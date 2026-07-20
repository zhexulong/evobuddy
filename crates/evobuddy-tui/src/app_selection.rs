use crate::app::WorkbenchApp;
use crate::app_types::*;
use crate::model::{FocusedBuddy, TeamAgent, WorkbenchState};
use crate::views::{DetailView, ViewMode};

impl WorkbenchApp {
    pub fn selection_snapshot(&self) -> SelectionSnapshot {
        SelectionSnapshot {
            focus: self.focus,
            selected_actor: self.selected_actor,
            selected_task_room: self.selected_task_room,
            selected_runtime_setup: self.selected_runtime_setup,
            selected_update: self.selected_update,
            view_mode: self.view_mode.clone(),
            back_stack: self.back_stack.clone(),
            selected_task_room_id: self.selected_task_room().map(|room| room.id.clone()),
            selected_participant_id: self
                .selected_task_room()
                .and_then(|room| room.participants.first().map(|p| p.id.clone())),
        }
    }
    pub fn restore_selection(&mut self, snapshot: &SelectionSnapshot) {
        self.focus = snapshot.focus;
        self.selected_actor = snapshot.selected_actor;
        self.selected_runtime_setup = snapshot.selected_runtime_setup;
        self.selected_update = snapshot.selected_update;
        self.view_mode = snapshot.view_mode.clone();
        self.back_stack = snapshot.back_stack.clone();
        if let Some(room_id) = snapshot.selected_task_room_id.as_ref() {
            if let Some(index) = self
                .state
                .task_rooms
                .iter()
                .position(|room| &room.id == room_id)
            {
                self.selected_task_room = index;
            } else {
                self.selected_task_room = snapshot
                    .selected_task_room
                    .min(self.state.task_rooms.len().saturating_sub(1));
            }
        } else {
            self.selected_task_room = snapshot
                .selected_task_room
                .min(self.state.task_rooms.len().saturating_sub(1));
        }
    }
    pub fn replace_state_preserving_selection(
        &mut self,
        state: WorkbenchState,
        snapshot: &SelectionSnapshot,
    ) {
        self.state = state;
        self.restore_selection(snapshot);
    }
    pub fn native_open_context(
        &self,
        room_id: &str,
        instance_id: &str,
    ) -> Option<NativeOpenContext> {
        let room = self
            .state
            .task_rooms
            .iter()
            .find(|room| room.id == room_id)?;
        let participant = room
            .participants
            .iter()
            .find(|participant| participant.id == instance_id)
            .or_else(|| room.participants.first())?;
        let native = self.state.native_sessions.iter().find(|session| {
            session.agent_instance_id == participant.id || session.room_id == room.id
        });
        Some(NativeOpenContext {
            project_root: self.state.project_root.clone(),
            room_id: room.id.clone(),
            agent_instance_id: participant.id.clone(),
            participant_name: participant.display_name.clone(),
            runtime: native
                .map(|session| session.runtime.clone())
                .unwrap_or_else(|| room.runtime.clone()),
            workspace: native
                .map(|session| session.workspace.clone())
                .unwrap_or_else(|| self.state.project_root.clone()),
            safety_mode: native
                .map(|session| session.safety_mode.clone())
                .unwrap_or_else(|| "workspace-write".to_string()),
            terminal_session_ref: native.map(|session| session.terminal_session_ref.clone()),
        })
    }
    pub fn filtered_actor_count(&self) -> usize {
        self.filtered_actor_entries().len()
    }
    pub fn unified_search_results(&self) -> Vec<SearchResult> {
        let query = self.search_query.trim().to_lowercase();
        if query.is_empty() {
            return Vec::new();
        }
        let mut results = Vec::new();
        for actor in &self.state.actors.team_agents {
            if actor.display_name.to_lowercase().contains(&query)
                || actor.role.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "Agent",
                    label: actor.display_name.clone(),
                });
            }
        }
        for buddy in &self.state.actors.focused_buddies {
            if buddy.display_name.to_lowercase().contains(&query)
                || buddy.routing_summary.to_lowercase().contains(&query)
                || buddy
                    .runtime_surfaces
                    .iter()
                    .any(|runtime| runtime.to_lowercase().contains(&query))
            {
                results.push(SearchResult {
                    kind: "Buddy",
                    label: buddy.display_name.clone(),
                });
            }
        }
        for room in &self.state.task_rooms {
            if room.title.to_lowercase().contains(&query)
                || room.summary.to_lowercase().contains(&query)
                || room.runtime.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "TaskRoom",
                    label: room.title.clone(),
                });
            }
        }
        for entry in &self.state.runtime_setup {
            let label = format!(
                "{} {} {}",
                entry.runtime, entry.team_agent, entry.focused_buddy
            );
            if label.to_lowercase().contains(&query) {
                results.push(SearchResult {
                    kind: "Runtime",
                    label,
                });
            }
        }
        for update in &self.state.updates {
            if update.text.to_lowercase().contains(&query)
                || update.kind.to_lowercase().contains(&query)
                || update.risk.to_lowercase().contains(&query)
            {
                results.push(SearchResult {
                    kind: "Update",
                    label: update.text.clone(),
                });
            }
        }
        results
    }
    pub fn visible_team_agents(&self) -> Vec<&TeamAgent> {
        let query = self.search_query.trim().to_lowercase();
        let mut items = self.sorted_team_agents();
        if query.is_empty() {
            return items;
        }
        items.retain(|actor| actor.display_name.to_lowercase().contains(&query));
        items
    }
    pub fn visible_focused_buddies(&self) -> Vec<&FocusedBuddy> {
        let query = self.search_query.trim().to_lowercase();
        let mut items = self.sorted_focused_buddies();
        if query.is_empty() {
            return items;
        }
        items.retain(|buddy| buddy.display_name.to_lowercase().contains(&query));
        items
    }
    pub fn filtered_actor_entries(&self) -> Vec<SelectedActor> {
        let query = self.search_query.trim().to_lowercase();
        let entries = self.all_actor_entries();
        if query.is_empty() {
            return entries;
        }
        entries
            .into_iter()
            .filter(|entry| {
                self.actor_label(*entry)
                    .map(|label| label.to_lowercase().contains(&query))
                    .unwrap_or(false)
            })
            .collect()
    }
    pub fn push_view(&mut self, next: ViewMode) {
        self.back_stack.push(self.view_mode.clone());
        self.view_mode = next;
    }
    pub fn pop_view(&mut self) {
        self.view_mode = self.back_stack.pop().unwrap_or(ViewMode::Dashboard);
        if self.view_mode != ViewMode::Search {
            self.search_query.clear();
        }
        if self.view_mode != ViewMode::CommandPalette {
            self.command_query.clear();
            self.selected_command = 0;
        }
        if self.view_mode != ViewMode::StructuredQuestion {
            self.structured_question = None;
        }
    }
    pub fn current_detail_view(&self) -> DetailView {
        match self.focus {
            FocusPane::TeamBuddies => match self.selected_actor {
                Some(SelectedActor::FocusedBuddy(_)) => DetailView::FocusedBuddy,
                _ => DetailView::TeamAgent,
            },
            FocusPane::TaskRooms => DetailView::TaskRoom,
            FocusPane::RuntimeSetup => DetailView::RuntimeSetup,
            FocusPane::Updates => DetailView::Updates,
        }
    }
    pub fn select_next_actor(&mut self, delta: isize) {
        let entries = if self.view_mode == ViewMode::Search {
            self.filtered_actor_entries()
        } else {
            self.all_actor_entries()
        };
        if entries.is_empty() {
            self.selected_actor = None;
            return;
        }
        let current_index = self
            .selected_actor
            .and_then(|selected| entries.iter().position(|entry| *entry == selected))
            .unwrap_or(0) as isize;
        let next_index = (current_index + delta).clamp(0, (entries.len() - 1) as isize) as usize;
        self.selected_actor = Some(entries[next_index]);
    }
    fn all_actor_entries(&self) -> Vec<SelectedActor> {
        let mut entries = Vec::new();
        entries.extend((0..self.state.actors.team_agents.len()).map(SelectedActor::TeamAgent));
        entries
            .extend((0..self.state.actors.focused_buddies.len()).map(SelectedActor::FocusedBuddy));
        entries
    }
    pub(crate) fn actor_label(&self, selected: SelectedActor) -> Option<String> {
        match selected {
            SelectedActor::TeamAgent(index) => self
                .state
                .actors
                .team_agents
                .get(index)
                .map(|actor| actor.display_name.clone()),
            SelectedActor::FocusedBuddy(index) => self
                .state
                .actors
                .focused_buddies
                .get(index)
                .map(|buddy| buddy.display_name.clone()),
        }
    }
}
