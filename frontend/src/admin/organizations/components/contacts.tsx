import { Component, createEffect, createSignal, For } from "solid-js";
import { SetStoreFunction } from "solid-js/store";
import { emptyContact, inputBase, MemberContactData } from "@/admin/organizations/functional/types";

export const ContactCarousel: Component<{
    contacts: MemberContactData[];
    setContacts: SetStoreFunction<MemberContactData[]>;
    disabled?: boolean;
}> = (props) => {
    const [slide, setSlide] = createSignal(0);

    const count = () => props.contacts.length;
    const clampSlide = (index: number) => Math.max(0, Math.min(index, Math.max(0, count() - 1)));

    createEffect(() => {
        setSlide(s => clampSlide(s));
    });

    const addContact = () => {
        const nextIndex = count();
        props.setContacts(nextIndex, emptyContact());
        setSlide(nextIndex);
    };

    const removeContact = (index: number) => {
        if (count() <= 1) {
            props.setContacts(0, emptyContact());
            setSlide(0);
            return;
        }
        props.setContacts(cs => cs.filter((_, i) => i !== index));
        setSlide(s => clampSlide(s >= index ? s - 1 : s));
    };

    return (
        <div class="flex flex-col gap-4 min-w-0">
            <div class="flex items-center justify-between gap-2">
                <span class="font-mono text-xs tracking-widest text-text/40 uppercase">Contacts</span>
                <button
                    type="button"
                    class="font-mono text-xs tracking-widest text-accent hover:text-accent/80 uppercase disabled:opacity-45"
                    onClick={addContact}
                    disabled={props.disabled}
                >
                    Add
                </button>
            </div>

            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="shrink-0 w-8 h-8 border border-text/15 rounded-sm text-text/50 hover:text-text hover:border-accent/40 disabled:opacity-30"
                    onClick={() => setSlide(s => Math.max(0, s - 1))}
                    disabled={props.disabled || slide() === 0}
                    aria-label="Previous contact"
                >
                    ‹
                </button>

                <div class="flex-1 overflow-hidden min-w-0">
                    <div
                        class="flex transition-transform duration-300 ease-out"
                        style={{ transform: `translateX(-${slide() * 100}%)` }}
                    >
                        <For each={props.contacts}>
                            {(contact, i) => (
                                <div class="min-w-full shrink-0 flex flex-col gap-3 px-0.5">
                                    <div class="flex items-center justify-between">
                                        <span class="font-mono text-xs text-text/30 tracking-widest uppercase">
                                            Contact {i() + 1}
                                        </span>
                                        <button
                                            type="button"
                                            class="font-mono text-xs tracking-widest text-red-400/70 hover:text-red-400 uppercase disabled:opacity-45"
                                            onClick={() => removeContact(i())}
                                            disabled={props.disabled}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Name</label>
                                        <input
                                            class={inputBase}
                                            value={contact.name}
                                            onInput={e => props.setContacts(i(), "name", e.currentTarget.value)}
                                            disabled={props.disabled}
                                        />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Email</label>
                                        <input
                                            class={inputBase}
                                            type="email"
                                            value={contact.email}
                                            onInput={e => props.setContacts(i(), "email", e.currentTarget.value)}
                                            disabled={props.disabled}
                                        />
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="font-mono text-xs tracking-widest text-text/30 uppercase">Number</label>
                                        <input
                                            class={inputBase}
                                            value={contact.contactNumber}
                                            onInput={e => props.setContacts(i(), "contactNumber", e.currentTarget.value)}
                                            disabled={props.disabled}
                                        />
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                <button
                    type="button"
                    class="shrink-0 w-8 h-8 border border-text/15 rounded-sm text-text/50 hover:text-text hover:border-accent/40 disabled:opacity-30"
                    onClick={() => setSlide(s => Math.min(count() - 1, s + 1))}
                    disabled={props.disabled || slide() >= count() - 1}
                    aria-label="Next contact"
                >
                    ›
                </button>
            </div>

            <div class="flex items-center justify-center gap-1.5">
                <For each={props.contacts}>
                    {(_, i) => (
                        <button
                            type="button"
                            class="w-1.5 h-1.5 rounded-full transition-colors"
                            classList={{
                                "bg-accent": slide() === i(),
                                "bg-text/25": slide() !== i(),
                            }}
                            onClick={() => setSlide(i())}
                            aria-label={`Show contact ${i() + 1}`}
                        />
                    )}
                </For>
            </div>
        </div>
    );
};

export const cleanedContacts = (contacts: MemberContactData[]): MemberContactData[] =>
    contacts
        .map(c => ({
            name: c.name.trim(),
            email: c.email.trim(),
            contactNumber: c.contactNumber.trim(),
        }))
        .filter(c => c.name || c.email || c.contactNumber);

export const contactsAreComplete = (contacts: MemberContactData[]) =>
    contacts.length > 0 && contacts.every(c => c.name && c.email && c.contactNumber);
