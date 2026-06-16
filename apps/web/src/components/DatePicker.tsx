'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';

interface DatePickerProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	min?: string;
	max?: string;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
	value,
	onChange,
	placeholder = 'Choose date',
	min,
	max,
}: DatePickerProps) {
	const trigger = useRef<HTMLButtonElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const selected = parseDate(value);
	const [open, setOpen] = useState(false);
	const [month, setMonth] = useState(() => startOfMonth(selected ?? new Date()));
	const [position, setPosition] = useState({ top: 0, left: 0 });
	const days = useMemo(() => calendarDays(month), [month]);

	useEffect(() => {
		if (!open) return;
		setMonth(startOfMonth(selected ?? new Date()));
		const update = () => {
			const rect = trigger.current?.getBoundingClientRect();
			if (!rect) return;
			const width = 292;
			setPosition({
				top: rect.bottom + 6,
				left: Math.min(rect.left, window.innerWidth - width - 12),
			});
		};
		const close = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false);
		};
		update();
		window.addEventListener('resize', update);
		window.addEventListener('scroll', update, true);
		document.addEventListener('pointerdown', close);
		return () => {
			window.removeEventListener('resize', update);
			window.removeEventListener('scroll', update, true);
			document.removeEventListener('pointerdown', close);
		};
	}, [open, value]);

	const select = (date: Date) => {
		onChange(formatDate(date));
		setOpen(false);
	};

	return (
		<>
			<button
				ref={trigger}
				type="button"
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}
				className="group flex min-w-[148px] items-center gap-2.5 rounded-lg border border-line-strong bg-bg-3 px-3 py-2.5 text-left text-[12px] text-fg shadow-sm outline-none transition hover:border-primary/70 hover:bg-[var(--list-hover)] focus:border-primary focus:ring-2 focus:ring-primary/15"
			>
				<Icon name="calendar" className="text-accent" />
				<span className={`flex-1 ${value ? 'text-fg' : 'text-fg-muted'}`}>
					{selected ? selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder}
				</span>
				<Icon name="chevron" className={`text-fg-muted transition-transform ${open ? '-rotate-90' : 'rotate-90'}`} />
			</button>

			{open &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						ref={panel}
						role="dialog"
						aria-label="Choose date"
						style={position}
						className="fixed z-[100] w-[292px] rounded-2xl border border-line-strong bg-bg-2 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl"
					>
						<div className="mb-3 flex items-center justify-between">
							<button
								type="button"
								onClick={() => setMonth(addMonths(month, -1))}
								className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-3 hover:text-fg"
								aria-label="Previous month"
							>
								<Icon name="chevron" className="rotate-180" />
							</button>
							<div className="text-[12.5px] font-semibold text-fg">
								{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
							</div>
							<button
								type="button"
								onClick={() => setMonth(addMonths(month, 1))}
								className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-3 hover:text-fg"
								aria-label="Next month"
							>
								<Icon name="chevron" />
							</button>
						</div>

						<div className="grid grid-cols-7 gap-1">
							{WEEKDAYS.map((day) => (
								<div key={day} className="py-1 text-center text-[9.5px] font-semibold uppercase text-fg-muted">
									{day}
								</div>
							))}
							{days.map((date) => {
								const dateValue = formatDate(date);
								const outside = date.getMonth() !== month.getMonth();
								const disabled = Boolean((min && dateValue < min) || (max && dateValue > max));
								const isSelected = value === dateValue;
								const today = dateValue === formatDate(new Date());
								return (
									<button
										key={dateValue}
										type="button"
										disabled={disabled}
										onClick={() => select(date)}
										className={`relative flex h-8 items-center justify-center rounded-lg text-[11px] transition disabled:cursor-not-allowed disabled:opacity-20 ${
											isSelected
												? 'bg-primary font-semibold text-primary-fg shadow-[0_5px_18px_rgba(0,120,212,0.35)]'
												: outside
													? 'text-fg-muted/45 hover:bg-bg-3'
													: 'text-fg hover:bg-bg-3'
										}`}
									>
										{date.getDate()}
										{today && !isSelected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" />}
									</button>
								);
							})}
						</div>

						<div className="mt-3 flex items-center justify-between border-t border-line pt-3">
							<button
								type="button"
								onClick={() => {
									onChange('');
									setOpen(false);
								}}
								className="rounded-md px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-3 hover:text-fg"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={() => select(new Date())}
								className="rounded-md bg-info-bg px-2.5 py-1 text-[11px] font-medium text-info"
							>
								Today
							</button>
						</div>
					</div>,
					document.body,
				)}
		</>
	);
}

const parseDate = (value: string): Date | null => {
	if (!value) return null;
	const [year, month, day] = value.split('-').map(Number);
	return year && month && day ? new Date(year, month - 1, day) : null;
};

const formatDate = (date: Date): string =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, amount: number): Date => new Date(date.getFullYear(), date.getMonth() + amount, 1);

const calendarDays = (month: Date): Date[] => {
	const first = new Date(month.getFullYear(), month.getMonth(), 1);
	const start = new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay());
	return Array.from({ length: 42 }, (_, index) =>
		new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
	);
};
