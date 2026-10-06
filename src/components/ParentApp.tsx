"use client";

import { useState } from "react";
import {
  parentNeeds,
  previewChildren,
  type ParentNeed,
} from "@/lib/parent-app";
import styles from "./ParentApp.module.css";

export default function ParentApp() {
  const [childId, setChildId] = useState(previewChildren[0].id);
  const [needId, setNeedId] = useState(parentNeeds[0].id);
  const child = previewChildren.find((item) => item.id === childId) ?? previewChildren[0];
  const need = parentNeeds.find((item) => item.id === needId) ?? parentNeeds[0];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>For families</p>
          <h1>Parents</h1>
          <p className={styles.lead}>
            One app for what a parent needs to know. Marketing, ops, uniforms, fees, and student
            experience keep their own desks. This is the door the family opens.
          </p>
        </div>
        <p className={styles.previewNote}>
          Preview household. These children show the shape of the app. They are not a live family,
          and nothing here is pulled from a pupil record.
        </p>
      </header>

      <section className={styles.household} aria-label="Children in this household">
        {previewChildren.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.child}
            data-active={item.id === child.id}
            aria-pressed={item.id === child.id}
            onClick={() => setChildId(item.id)}
          >
            <strong>{item.label}</strong>
            <span>
              {item.grade} · {item.campus}
            </span>
          </button>
        ))}
      </section>

      <section className={styles.today} aria-label="What a parent would open">
        <div className={styles.todayHead}>
          <h2>Today, for {child.label.toLowerCase()}</h2>
          <p>Five questions. One answer each. The desk that owns the work stays named on the card.</p>
        </div>
        <div className={styles.questions}>
          {parentNeeds.map((item) => (
            <QuestionCard
              key={item.id}
              need={item}
              answer={item.today[child.id]}
              active={item.id === need.id}
              onSelect={() => setNeedId(item.id)}
            />
          ))}
        </div>
      </section>

      <section className={styles.detail} aria-live="polite">
        <div className={styles.detailMain}>
          <p className={styles.detailKicker}>{need.desk}</p>
          <h2>{need.question}</h2>
          <p>{need.summary}</p>
          <p className={styles.state} data-state={need.state}>
            {need.stateLabel}
          </p>
        </div>
        <div className={styles.split}>
          <div>
            <h3>The parent sees</h3>
            <ul>
              {need.parentSees.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>The desk keeps</h3>
            <ul>
              {need.deskKeeps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuestionCard({
  need,
  answer,
  active,
  onSelect,
}: {
  need: ParentNeed;
  answer: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={styles.card} data-active={active} aria-pressed={active} onClick={onSelect}>
      <span className={styles.cardTop}>
        <strong>{need.name}</strong>
        <em data-state={need.state}>{need.stateLabel}</em>
      </span>
      <span className={styles.question}>{need.question}</span>
      <span className={styles.answer}>{answer}</span>
    </button>
  );
}
