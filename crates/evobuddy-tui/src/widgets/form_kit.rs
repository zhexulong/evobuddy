use ratatui::layout::{Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;
use ratatui::Frame;

/// Shared field presentation for TUI forms.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FormFieldView {
    pub label: &'static str,
    pub value: String,
    pub active: bool,
    pub error: Option<String>,
}

fn surface_block(title: &str, focused: bool) -> ratatui::widgets::Block<'static> {
    use ratatui::widgets::{Block, Borders};
    let border = if focused {
        Style::default()
            .fg(Color::Cyan)
            .add_modifier(Modifier::BOLD)
    } else {
        Style::default().fg(Color::DarkGray)
    };
    Block::default()
        .title(title.to_string())
        .borders(Borders::ALL)
        .border_style(border)
}

fn active_style() -> Style {
    Style::default()
        .fg(Color::Black)
        .bg(Color::Yellow)
        .add_modifier(Modifier::REVERSED | Modifier::BOLD)
}

fn inactive_style() -> Style {
    Style::default().fg(Color::Gray)
}

fn error_style() -> Style {
    Style::default()
        .fg(Color::Red)
        .add_modifier(Modifier::BOLD)
}

fn muted_style() -> Style {
    Style::default().fg(Color::DarkGray)
}

/// Layout constants shared by render + cursor math.
/// Outer vertical: title (3) | fields (min) | help (2)
const TITLE_HEIGHT: u16 = 3;
const HELP_HEIGHT: u16 = 2;
/// Per field: one value line + optional error line → we reserve 2 rows each.
const FIELD_ROW_HEIGHT: u16 = 2;
/// Inner padding of the fields block (borders).
const INNER_PAD_X: u16 = 1;
const INNER_PAD_Y: u16 = 1;

/// Render a titled form with active-field highlight and caret marker.
pub fn render_form(
    frame: &mut Frame<'_>,
    area: Rect,
    title: &str,
    fields: &[FormFieldView],
    help: &str,
) {
    let rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(TITLE_HEIGHT),
            Constraint::Min(4),
            Constraint::Length(HELP_HEIGHT),
        ])
        .split(area);

    frame.render_widget(
        Paragraph::new(vec![Line::from(Span::styled(
            title.to_string(),
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ))])
        .block(surface_block(title, true)),
        rows[0],
    );

    let mut lines: Vec<Line> = Vec::new();
    for field in fields {
        let style = if field.active {
            active_style()
        } else {
            inactive_style()
        };
        let caret = if field.active { "█" } else { " " };
        let value_display = if field.value.is_empty() && field.active {
            format!("{caret}")
        } else {
            format!("{}{caret}", field.value)
        };
        lines.push(Line::from(vec![
            Span::styled(format!("{}: ", field.label), style),
            Span::styled(value_display, style),
        ]));
        if let Some(err) = &field.error {
            lines.push(Line::from(Span::styled(
                format!("  ! {err}"),
                error_style(),
            )));
        } else {
            lines.push(Line::from(""));
        }
    }

    frame.render_widget(
        Paragraph::new(lines).block(surface_block("Fields", false)),
        rows[1],
    );

    frame.render_widget(
        Paragraph::new(Line::from(Span::styled(help.to_string(), muted_style()))),
        rows[2],
    );
}

/// Compute absolute terminal coordinates for the caret of the active field.
/// Layout must match `render_form`.
pub fn active_field_cursor(area: Rect, fields: &[FormFieldView]) -> Option<(u16, u16)> {
    let active_index = fields.iter().position(|f| f.active)?;
    // Vertical: title block + fields block top border + rows before active
    let fields_body_y = area.y + TITLE_HEIGHT + INNER_PAD_Y;
    // Each field occupies FIELD_ROW_HEIGHT lines (value + error/spacer)
    let mut y_offset = 0u16;
    for (i, field) in fields.iter().enumerate() {
        if i == active_index {
            break;
        }
        // value line + error or spacer line
        y_offset = y_offset.saturating_add(FIELD_ROW_HEIGHT);
        let _ = field;
    }
    let y = fields_body_y.saturating_add(y_offset);

    let field = &fields[active_index];
    // "Label: value" — cursor sits after value (before caret glyph in snapshot, at end of text)
    let label_prefix = format!("{}: ", field.label);
    let x = area
        .x
        .saturating_add(INNER_PAD_X)
        .saturating_add(1) // block border
        .saturating_add(label_prefix.chars().count() as u16)
        .saturating_add(field.value.chars().count() as u16);

    Some((x, y))
}

/// Optionally place the terminal cursor for interactive renders.
pub fn place_form_cursor(frame: &mut Frame<'_>, area: Rect, fields: &[FormFieldView]) {
    if let Some((x, y)) = active_field_cursor(area, fields) {
        frame.set_cursor_position((x, y));
    }
}
