import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import GoalProgressRing from '../../../src/components/goals/GoalProgressRing.jsx';

/**
 * The ring is the part of a goal card that can be read without reading any
 * number, so these assertions are about the exposed ARIA state, the visible
 * percentage and the colour switch. jsdom applies no stylesheet, so a class
 * name is the only honest thing to assert about colour - and that class is the
 * contract with the design system (`stroke-primary` / `stroke-success`).
 */

const ring = (label = 'Japan trip progress') =>
  screen.getByRole('progressbar', { name: label });

const arcOf = (label) => ring(label).querySelectorAll('circle')[1];

describe('GoalProgressRing — the visible percentage', () => {
  it('shows the whole percentage and a "saved" caption', () => {
    render(<GoalProgressRing percent={25} label="Japan trip progress" />);
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();
  });

  it('rounds a fractional percentage for display', () => {
    render(<GoalProgressRing percent={79.95} label="Japan trip progress" />);
    expect(screen.getByText('80%')).toBeInTheDocument();
  });

  it('shows 0% for an untouched goal', () => {
    render(<GoalProgressRing percent={0} label="Japan trip progress" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('goes past 100% rather than pretending the goal stopped there', () => {
    render(<GoalProgressRing percent={110} label="Japan trip progress" />);
    expect(screen.getByText('110%')).toBeInTheDocument();
  });

  it('treats a missing percentage as zero', () => {
    render(<GoalProgressRing label="Japan trip progress" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});

describe('GoalProgressRing — the arc', () => {
  it('draws a quarter of the circle at 25%', () => {
    render(<GoalProgressRing percent={25} label="Japan trip progress" />);
    expect(arcOf('Japan trip progress')).toHaveAttribute(
      'stroke-dashoffset',
      '75',
    );
  });

  it('is empty at 0% and full at 100%', () => {
    const { rerender } = render(
      <GoalProgressRing percent={0} label="Japan trip progress" />,
    );
    expect(arcOf('Japan trip progress')).toHaveAttribute(
      'stroke-dashoffset',
      '100',
    );

    rerender(<GoalProgressRing percent={100} label="Japan trip progress" />);
    expect(arcOf('Japan trip progress')).toHaveAttribute(
      'stroke-dashoffset',
      '0',
    );
  });

  it('caps the arc at a full circle when over-saved', () => {
    render(<GoalProgressRing percent={150} label="Japan trip progress" />);
    expect(arcOf('Japan trip progress')).toHaveAttribute(
      'stroke-dashoffset',
      '0',
    );
  });

  it('never draws a negative arc', () => {
    render(<GoalProgressRing percent={-20} label="Japan trip progress" />);
    expect(arcOf('Japan trip progress')).toHaveAttribute(
      'stroke-dashoffset',
      '100',
    );
  });
});

describe('GoalProgressRing — colour and accessible state', () => {
  it('uses the primary colour while in progress', () => {
    render(<GoalProgressRing percent={60} label="Japan trip progress" />);
    expect(arcOf('Japan trip progress')).toHaveClass('stroke-primary');
    expect(arcOf('Japan trip progress')).not.toHaveClass('stroke-success');
  });

  it('switches to success and a check badge when achieved', () => {
    render(
      <GoalProgressRing percent={100} label="Japan trip progress" achieved />,
    );
    expect(arcOf('Japan trip progress')).toHaveClass('stroke-success');
    expect(screen.getByText('complete')).toBeInTheDocument();
    expect(screen.queryByText('saved')).not.toBeInTheDocument();
  });

  it('reports 25% with progressbar semantics', () => {
    render(<GoalProgressRing percent={25} label="Japan trip progress" />);
    expect(ring()).toHaveAttribute('aria-valuenow', '25');
    expect(ring()).toHaveAttribute('aria-valuemin', '0');
    expect(ring()).toHaveAttribute('aria-valuemax', '100');
    expect(ring()).toHaveAttribute('aria-valuetext', '25% saved');
  });

  it('caps aria-valuenow at 100 but keeps the real figure in valuetext', () => {
    render(<GoalProgressRing percent={110} label="Japan trip progress" />);
    expect(ring()).toHaveAttribute('aria-valuenow', '100');
    expect(ring()).toHaveAttribute('aria-valuetext', '110% saved');
  });

  it('announces completion instead of a percentage when achieved', () => {
    render(
      <GoalProgressRing percent={100} label="Japan trip progress" achieved />,
    );
    expect(ring()).toHaveAttribute('aria-valuetext', 'Goal reached');
  });
});
