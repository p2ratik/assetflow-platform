import { useState, useRef, useEffect } from 'react';
import './Tabs.css';

export default function Tabs({ tabs, activeTab, onChange, className = '' }) {
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabRefs = useRef([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const activeIndex = tabs.findIndex((t) => t.key === activeTab);
    const el = tabRefs.current[activeIndex];
    if (el) {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div className={`af-tabs ${className}`} ref={containerRef} role="tablist">
      <div className="af-tabs__list">
        {tabs.map((tab, i) => (
          <button
            key={tab.key}
            ref={(el) => (tabRefs.current[i] = el)}
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`af-tabs__tab ${activeTab === tab.key ? 'af-tabs__tab--active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon && <span className="af-tabs__icon">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className="af-tabs__count">{tab.count}</span>
            )}
          </button>
        ))}
        <div className="af-tabs__indicator" style={indicatorStyle} />
      </div>
    </div>
  );
}
