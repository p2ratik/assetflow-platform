import Badge from './Badge';
import Card from './Card';
import './KanbanColumn.css';

export default function KanbanColumn({
  title,
  status,
  items = [],
  count,
  color,
  renderCard,
  onCardClick,
  className = '',
}) {
  const displayCount = count ?? items.length;

  return (
    <div className={`af-kanban-col ${className}`}>
      <div className="af-kanban-col__header">
        <div
          className="af-kanban-col__stripe"
          style={{ backgroundColor: color || 'var(--accent-primary)' }}
        />
        <div className="af-kanban-col__title-row">
          <h4 className="af-kanban-col__title">{title}</h4>
          <span className="af-kanban-col__count">{displayCount}</span>
        </div>
      </div>

      <div className="af-kanban-col__body">
        {items.length === 0 ? (
          <div className="af-kanban-col__empty">
            No items
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="af-kanban-col__card animate-in"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => onCardClick?.(item)}
            >
              {renderCard ? (
                renderCard(item)
              ) : (
                <Card variant="compact" hover>
                  <div className="af-kanban-col__card-default">
                    <span className="af-kanban-col__card-title">
                      {item.title || item.name || `Item #${item.id}`}
                    </span>
                    {item.priority && (
                      <Badge status={item.priority} size="sm">
                        {item.priority}
                      </Badge>
                    )}
                    {item.assignee && (
                      <span className="af-kanban-col__card-assignee">
                        {item.assignee}
                      </span>
                    )}
                  </div>
                </Card>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
