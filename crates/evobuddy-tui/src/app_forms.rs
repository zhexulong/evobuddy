use crate::app::WorkbenchApp;
use crate::app_types::*;
use crate::views::ViewMode;

impl WorkbenchApp {
    pub fn open_task_room_form(&mut self) {
        self.task_room_form = CreateTaskRoomDraft {
            objective: String::new(),
            acceptance_criteria: String::new(),
            workspace: self.state.project_root.clone(),
            actor: String::new(),
            runtime: {
                let preferred = ["opencode", "claude", "codex"];
                preferred
                    .into_iter()
                    .find(|name| {
                        self.state
                            .runtime_setup
                            .iter()
                            .any(|entry| entry.runtime.eq_ignore_ascii_case(name))
                    })
                    .unwrap_or("opencode")
                    .to_string()
            },
            safety_mode: "workspace-write".to_string(),
        };
        self.task_room_form_field = 0;
        self.push_view(ViewMode::TaskRoomForm);
    }
    pub fn open_handoff_form(&mut self) {
        self.handoff_form = CreateHandoffDraft {
            sender: String::new(),
            receiver: String::new(),
            body: String::new(),
            artifact_refs: String::new(),
            expected_next_action: String::new(),
            return_destination: String::new(),
        };
        self.handoff_form_field = 0;
        self.push_view(ViewMode::HandoffForm);
    }
    pub fn advance_active_form_field(&mut self) {
        match self.view_mode {
            ViewMode::TaskRoomForm => {
                self.task_room_form_field = (self.task_room_form_field + 1).min(5);
            }
            ViewMode::HandoffForm => {
                self.handoff_form_field = (self.handoff_form_field + 1).min(5);
            }
            _ => {}
        }
    }
    pub fn append_to_active_input(&mut self, ch: char) {
        match self.view_mode {
            ViewMode::TaskRoomForm => match self.task_room_form_field {
                0 => self.task_room_form.objective.push(ch),
                1 => self.task_room_form.acceptance_criteria.push(ch),
                2 => self.task_room_form.workspace.push(ch),
                3 => self.task_room_form.actor.push(ch),
                4 => self.task_room_form.runtime.push(ch),
                5 => self.task_room_form.safety_mode.push(ch),
                _ => {}
            },
            ViewMode::HandoffForm => match self.handoff_form_field {
                0 => self.handoff_form.sender.push(ch),
                1 => self.handoff_form.receiver.push(ch),
                2 => self.handoff_form.body.push(ch),
                3 => self.handoff_form.artifact_refs.push(ch),
                4 => self.handoff_form.expected_next_action.push(ch),
                5 => self.handoff_form.return_destination.push(ch),
                _ => {}
            },
            ViewMode::StructuredQuestion => {
                if let Some(question) = &mut self.structured_question {
                    if question.allows_free_text {
                        question.free_text.push(ch);
                    }
                }
            }
            _ => {}
        }
    }
    pub fn submit_task_room_form(&mut self) -> WorkbenchEffect {
        let draft = self.task_room_form.clone();
        let target = if draft.objective.is_empty() {
            "taskroom create".to_string()
        } else {
            format!("taskroom create · {}", draft.objective)
        };
        self.request_confirmation(PendingConfirmation {
            target,
            effect_label: "Create TaskRoom".to_string(),
            action: ConfirmedAction::CreateTaskRoom(draft),
        })
    }
    pub fn submit_handoff_form(&mut self) -> WorkbenchEffect {
        let draft = self.handoff_form.clone();
        let target = format!(
            "handoff {} → {}",
            if draft.sender.is_empty() {
                "?"
            } else {
                &draft.sender
            },
            if draft.receiver.is_empty() {
                "?"
            } else {
                &draft.receiver
            }
        );
        self.request_confirmation(PendingConfirmation {
            target,
            effect_label: "Create Handoff".to_string(),
            action: ConfirmedAction::CreateHandoff(draft),
        })
    }
    pub fn submit_structured_answer(&mut self, index: usize) -> WorkbenchEffect {
        let Some(question) = &self.structured_question else {
            return WorkbenchEffect::None;
        };
        let answer = question
            .choices
            .get(index)
            .map(|choice| choice.id.clone())
            .or_else(|| {
                if question.allows_free_text && !question.free_text.is_empty() {
                    Some(question.free_text.clone())
                } else {
                    None
                }
            });
        let Some(answer) = answer else {
            return WorkbenchEffect::None;
        };
        self.action_status = Some("structured answer recorded".to_string());
        self.push_view(ViewMode::ActionProgress);
        WorkbenchEffect::AnswerQuestion(answer)
    }
}
