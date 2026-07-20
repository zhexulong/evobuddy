use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

use crate::action_hints::ActionHint;
use crate::theme::{action_bar_block, theme};

pub fn render_action_bar(
    frame: &mut Frame<'_>,
    area: Rect,
    hints: &[ActionHint],
    status: Option<&str>,
) {
    let tokens = theme();
    let mut spans: Vec<Span> = Vec::new();
    for (i, hint) in hints.iter().enumerate() {
        if i > 0 {
            spans.push(Span::styled("  ", Style::default().fg(tokens.action_bar_fg)));
        }
        let key_style = if hint.enabled {
            Style::default()
                .fg(tokens.action_bar_fg)
                .bg(tokens.action_bar_bg)
                .add_modifier(Modifier::BOLD | Modifier::REVERSED)
        } else {
            Style::default()
                .fg(tokens.text_muted)
                .bg(tokens.action_bar_bg)
        };
        let label_style = if hint.enabled {
            Style::default()
                .fg(tokens.action_bar_fg)
                .bg(tokens.action_bar_bg)
        } else {
            Style::default()
                .fg(tokens.text_muted)
                .bg(tokens.action_bar_bg)
        };
        spans.push(Span::styled(format!(" {} ", hint.key), key_style));
        spans.push(Span::styled(format!(" {} ", hint.label), label_style));
        if !hint.enabled {
            if let Some(reason) = &hint.disabled_reason {
                spans.push(Span::styled(
                    format!("({})", truncate(reason, 24)),
                    Style::default()
                        .fg(tokens.text_muted)
                        .bg(tokens.action_bar_bg),
                ));
            }
        }
    }
    if let Some(status) = status.filter(|s| !s.is_empty()) {
        if !spans.is_empty() {
            spans.push(Span::styled(
                " │ ",
                Style::default()
                    .fg(tokens.action_bar_fg)
                    .bg(tokens.action_bar_bg),
            ));
        }
        spans.push(Span::styled(
            truncate(status, 40),
            Style::default()
                .fg(tokens.action_bar_fg)
                .bg(tokens.action_bar_bg),
        ));
    }
    if spans.is_empty() {
        spans.push(Span::styled(
            " Enter Open   n New room   / Search   : Commands   ? Help ",
            Style::default()
                .fg(tokens.action_bar_fg)
                .bg(tokens.action_bar_bg),
        ));
    }

    let bar = Paragraph::new(Line::from(spans))
        .style(
            Style::default()
                .fg(tokens.action_bar_fg)
                .bg(tokens.action_bar_bg),
        )
        .block(action_bar_block());
    frame.render_widget(bar, area);
}

fn truncate(text: &str, max: usize) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= max {
        return text.to_string();
    }
    chars.into_iter().take(max.saturating_sub(1)).collect::<String>() + "…"
}
