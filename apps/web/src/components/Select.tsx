'use client';

import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
	value: string;
	label: string;
	description?: string;
}

interface SelectProps {
	value: string;
	options: SelectOption[];
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	compact?: boolean;
}

export function Select({
	value,
	options,
	onChange,
	placeholder = 'Select an option',
	disabled = false,
	className = '',
	compact = false,
}: SelectProps) {
	const id = useId();
	const trigger = useRef<HTMLButtonElement>(null);
	const menu = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
	const selected = options.find((option) => option.value === value);

	useEffect(() => {
		if (!open) return;
		const update = () => {
			const rect = trigger.current?.getBoundingClientRect();
			if (!rect) return;
			setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
		};
		const close = (event: PointerEvent) => {
			const target = event.target as Node;
			if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
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
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const selectedIndex = options.findIndex((option) => option.value === value);
		setActive(selectedIndex >= 0 ? selectedIndex : 0);
		requestAnimationFrame(() => menu.current?.focus());
	}, [open, options, value]);

	const choose = (option: SelectOption) => {
		onChange(option.value);
		setOpen(false);
		trigger.current?.focus();
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.key === 'Escape') {
			setOpen(false);
			trigger.current?.focus();
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			const direction = event.key === 'ArrowDown' ? 1 : -1;
			setActive((current) => (current + direction + options.length) % options.length);
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			const option = options[active];
			if (option) choose(option);
		}
	};

	return (
		<>
			<button
				ref={trigger}
				type="button"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((current) => !current)}
				className={`group flex w-full items-center justify-between gap-3 rounded-lg border border-line-strong bg-bg-3 text-left text-fg shadow-sm outline-none transition hover:border-primary/70 hover:bg-[var(--list-hover)] focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 ${
					compact ? 'px-2.5 py-1.5 text-[11.5px]' : 'px-3 py-2.5 text-[12.5px]'
				} ${className}`}
			>
				<span className="min-w-0">
					<span className="block truncate">{selected?.label ?? placeholder}</span>
					{selected?.description && !compact && (
						<span className="mt-0.5 block truncate text-[10.5px] text-fg-muted">{selected.description}</span>
					)}
				</span>
				<Icon
					name="chevron"
					className={`shrink-0 text-fg-muted transition-transform ${open ? '-rotate-90' : 'rotate-90'}`}
				/>
			</button>

			{open &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						ref={menu}
						id={id}
						role="listbox"
						tabIndex={-1}
						onKeyDown={onKeyDown}
						style={{ top: position.top, left: position.left, width: Math.max(position.width, 180) }}
						className="fixed z-[100] max-h-72 overflow-auto rounded-xl border border-line-strong bg-bg-2 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] outline-none backdrop-blur-xl"
					>
						{options.map((option, index) => {
							const isSelected = option.value === value;
							const isActive = index === active;
							return (
								<button
									key={option.value}
									type="button"
									role="option"
									aria-selected={isSelected}
									onMouseEnter={() => setActive(index)}
									onClick={() => choose(option)}
									className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
										isActive ? 'bg-[var(--list-hover)]' : ''
									}`}
								>
									<span className="min-w-0 flex-1">
										<span className={`block truncate text-[12px] ${isSelected ? 'font-semibold text-accent' : 'text-fg'}`}>
											{option.label}
										</span>
										{option.description && (
											<span className="mt-0.5 block truncate text-[10.5px] text-fg-muted">{option.description}</span>
										)}
									</span>
									{isSelected && <Icon name="check" className="shrink-0 text-accent" />}
								</button>
							);
						})}
					</div>,
					document.body,
				)}
		</>
	);
}
