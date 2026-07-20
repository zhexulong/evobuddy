use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::app::WorkbenchApp;
use crate::theme::{muted_style, section_style, surface_block};

pub fn render_trace_drawer(frame: &mut Frame<'_>, app: &WorkbenchApp, area: ratatui::layout::Rect) {
    let diagnostics = &app.state.diagnostics;
    let mut lines = vec![
        Line::from(Span::styled("Trace", section_style())),
        Line::from(format!("Claim ceiling: {}", diagnostics.claim_ceiling)),
        Line::from(format!(
            "Proof fields hidden: {}",
            diagnostics.hidden_proof_fields_present
        )),
        Line::from(format!(
            "Generated: {}",
            app.state.generated_at.as_deref().unwrap_or("unknown")
        )),
        Line::from("Esc back"),
    ];
    if diagnostics.blocked_reasons.is_empty() {
        lines.push(Line::from(Span::styled(
            "No blocked reasons",
            muted_style(),
        )));
    } else {
        lines.push(Line::from(Span::styled("Blocked reasons", section_style())));
        lines.extend(
            diagnostics
                .blocked_reasons
                .iter()
                .map(|reason| Line::from(reason.clone())),
        );
    }
    lines.push(Line::from(Span::styled(
        "Recovery diagnostics",
        section_style(),
    )));
    let recovery = app.recovery_diagnostic_lines();
    if recovery.is_empty() {
        lines.push(Line::from(Span::styled(
            "No recovery diagnostics",
            muted_style(),
        )));
    } else {
        lines.extend(recovery.into_iter().map(Line::from));
    }
    lines.push(Line::from(Span::styled(
        "Proof taxonomy (trace only)",
        section_style(),
    )));
    lines.push(Line::from(
        "exact-resume · heuristic-resume · continue-with-context · fresh-session",
    ));
    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Trace", true)),
        area,
    );
}
