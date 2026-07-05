import { useState, useEffect } from 'react'

const API = 'https://lifting-app-production.up.railway.app'

function App() {
  const [screen, setScreen] = useState('templates')
  const [templates, setTemplates] = useState([])
  const [exercises, setExercises] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [workout, setWorkout] = useState(null)
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [todaysSets, setTodaysSets] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTemplates()
    fetchExercises()
  }, [])

  function fetchTemplates() {
    fetch(`${API}/templates`)
      .then(res => res.json())
      .then(setTemplates)
  }

  function fetchExercises() {
    fetch(`${API}/exercises`)
      .then(res => res.json())
      .then(setExercises)
  }

  async function startWorkout(templateId) {
    setLoading(true)
    try {
      const sessionRes = await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId })
      })
      const { session_id } = await sessionRes.json()
      const workoutRes = await fetch(
        `${API}/templates/${templateId}/workout?session_id=${session_id}`
      )
      const workoutData = await workoutRes.json()
      setSessionId(session_id)
      setWorkout(workoutData)
      setExerciseIndex(0)
      setTodaysSets([])
      setScreen('workout')
    } finally {
      setLoading(false)
    }
  }

  async function logSet(exerciseId, weight, reps) {
    await fetch(`${API}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, exercise_id: exerciseId, weight, reps })
    })
    setTodaysSets(prev => [...prev, { exerciseId, weight, reps }])
    const recRes = await fetch(`${API}/recommend/${exerciseId}?session_id=${sessionId}`)
    const recData = await recRes.json()
    setWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.exercise_id === exerciseId ? { ...ex, recommendation: recData } : ex
      )
    }))
  }

  function finishExercise() {
    if (exerciseIndex < workout.exercises.length - 1) {
      setExerciseIndex(i => i + 1)
    } else {
      setScreen('done')
    }
  }

  async function saveTemplate(name, exerciseIds) {
    await fetch(`${API}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, exercise_ids: exerciseIds })
    })
    fetchTemplates()
    setScreen('templates')
  }

  async function saveExercise(name, category, increment) {
    await fetch(`${API}/exercises`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, increment })
    })
    fetchExercises()
    setScreen('manageExercises')
  }

  function reset() {
    setScreen('templates')
    setSessionId(null)
    setWorkout(null)
    setExerciseIndex(0)
    setTodaysSets([])
  }

  if (screen === 'workout' && workout) {
    const exercise = workout.exercises[exerciseIndex]
    const setsToday = todaysSets.filter(s => s.exerciseId === exercise.exercise_id)
    const isLast = exerciseIndex === workout.exercises.length - 1
    const nextName = !isLast ? workout.exercises[exerciseIndex + 1].name : null
    return (
      <WorkoutScreen
        templateName={workout.template_name}
        exercise={exercise}
        exerciseNumber={exerciseIndex + 1}
        totalExercises={workout.exercises.length}
        setsToday={setsToday}
        onLogSet={(w, r) => logSet(exercise.exercise_id, w, r)}
        onFinishExercise={finishExercise}
        isLast={isLast}
        nextName={nextName}
      />
    )
  }

  if (screen === 'done') return <DoneScreen onBack={reset} />

  if (screen === 'newTemplate') {
    return (
      <NewTemplateScreen
        exercises={exercises}
        onSave={saveTemplate}
        onBack={() => setScreen('templates')}
      />
    )
  }

  if (screen === 'manageExercises') {
    return (
      <ManageExercisesScreen
        exercises={exercises}
        onNew={() => setScreen('newExercise')}
        onBack={() => setScreen('templates')}
      />
    )
  }

  if (screen === 'newExercise') {
    return (
      <NewExerciseScreen
        onSave={saveExercise}
        onBack={() => setScreen('manageExercises')}
      />
    )
  }

  return (
    <TemplateListScreen
      templates={templates}
      onSelect={startWorkout}
      onNew={() => setScreen('newTemplate')}
      onManageExercises={() => setScreen('manageExercises')}
      loading={loading}
    />
  )
}

function TemplateListScreen({ templates, onSelect, onNew, onManageExercises, loading }) {
  return (
    <div className="min-h-screen bg-gray-950 px-5 py-10">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">
        Let's get it
      </p>
      <h1 className="text-3xl font-bold text-white mb-8">Today's workout</h1>

      <div className="flex flex-col gap-3 mb-6">
        {templates.map(template => (
          <button
            key={template.template_id}
            disabled={loading}
            onClick={() => onSelect(template.template_id)}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-left active:scale-[0.98] transition disabled:opacity-40"
          >
            <div className="text-lg font-semibold text-white">{template.name}</div>
            <div className="text-sm text-gray-400 mt-1">
              {template.exercises.map(e => e.name).join(' · ')}
            </div>
          </button>
        ))}
        {templates.length === 0 && (
          <p className="text-sm text-gray-600">No templates yet — create one below.</p>
        )}
      </div>

      <button
        onClick={onNew}
        className="w-full border border-dashed border-gray-700 text-gray-500 font-medium rounded-2xl py-4 mb-3 active:scale-[0.98] transition"
      >
        + New template
      </button>

      <button
        onClick={onManageExercises}
        className="w-full border border-gray-800 text-gray-600 font-medium rounded-2xl py-3 active:scale-[0.98] transition text-sm"
      >
        Manage exercises
      </button>

      {loading && (
        <p className="text-center text-sm text-gray-500 mt-8">Starting workout...</p>
      )}
    </div>
  )
}

function ManageExercisesScreen({ exercises, onNew, onBack }) {
  const categories = [...new Set(exercises.map(e => e.category))]

  return (
    <div className="min-h-screen bg-gray-950 px-5 py-10">
      <button onClick={onBack} className="text-gray-500 text-sm mb-6">
        ← Back
      </button>
      <h1 className="text-3xl font-bold text-white mb-6">Exercises</h1>

      {categories.map(cat => (
        <div key={cat} className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {cat}
          </p>
          <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {exercises
              .filter(e => e.category === cat)
              .map(ex => (
                <div key={ex.id} className="flex justify-between items-center px-4 py-3">
                  <span className="text-white font-medium">{ex.name}</span>
                  <span className="text-xs text-gray-500">+{ex.increment} lbs</span>
                </div>
              ))}
          </div>
        </div>
      ))}

      <button
        onClick={onNew}
        className="w-full border border-dashed border-gray-700 text-gray-500 font-medium rounded-2xl py-4 active:scale-[0.98] transition"
      >
        + Add exercise
      </button>
    </div>
  )
}

function NewExerciseScreen({ onSave, onBack }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Push')
  const [increment, setIncrement] = useState(5)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onSave(name.trim(), category, increment)
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 px-5 py-10">
      <button onClick={onBack} className="text-gray-500 text-sm mb-6">
        ← Back
      </button>
      <h1 className="text-3xl font-bold text-white mb-6">New exercise</h1>

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Exercise name
      </p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Incline Bench"
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 mb-6 text-base outline-none focus:border-blue-600"
      />

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Category
      </p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {['Push', 'Pull', 'Legs'].map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`py-3 rounded-xl border text-sm font-semibold transition ${
              category === cat
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-900 border-gray-800 text-gray-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Weight increment (lbs)
      </p>
      <div className="grid grid-cols-3 gap-2 mb-8">
        {[2.5, 5, 10].map(inc => (
          <button
            key={inc}
            onClick={() => setIncrement(inc)}
            className={`py-3 rounded-xl border text-sm font-semibold transition ${
              increment === inc
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-gray-900 border-gray-800 text-gray-400'
            }`}
          >
            +{inc}
          </button>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || saving}
        className="w-full bg-blue-600 text-white font-semibold rounded-xl py-4 disabled:opacity-30 active:scale-[0.98] transition"
      >
        {saving ? 'Saving...' : 'Save exercise'}
      </button>
    </div>
  )
}

function NewTemplateScreen({ exercises, onSave, onBack }) {
  const [name, setName] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleExercise(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!name.trim() || selectedIds.length === 0) return
    setSaving(true)
    await onSave(name.trim(), selectedIds)
    setSaving(false)
  }

  const categories = [...new Set(exercises.map(e => e.category))]

  return (
    <div className="min-h-screen bg-gray-950 px-5 py-10">
      <button onClick={onBack} className="text-gray-500 text-sm mb-6">
        ← Back
      </button>
      <h1 className="text-3xl font-bold text-white mb-6">New template</h1>

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Template name
      </p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="e.g. Push Day"
        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 mb-6 text-base outline-none focus:border-blue-600"
      />

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Select exercises
      </p>

      {categories.map(cat => (
        <div key={cat} className="mb-4">
          <p className="text-xs text-gray-600 mb-2">{cat}</p>
          <div className="flex flex-col gap-2">
            {exercises
              .filter(e => e.category === cat)
              .map(ex => (
                <button
                  key={ex.id}
                  onClick={() => toggleExercise(ex.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition active:scale-[0.98] ${
                    selectedIds.includes(ex.id)
                      ? 'bg-blue-950 border-blue-700 text-white'
                      : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <span className="font-medium">{ex.name}</span>
                  {selectedIds.includes(ex.id) && (
                    <span className="text-blue-400">✓</span>
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={!name.trim() || selectedIds.length === 0 || saving}
        className="w-full bg-blue-600 text-white font-semibold rounded-xl py-4 mt-4 disabled:opacity-30 active:scale-[0.98] transition"
      >
        {saving ? 'Saving...' : `Save template (${selectedIds.length} exercises)`}
      </button>
    </div>
  )
}

function WorkoutScreen({
  templateName, exercise, exerciseNumber, totalExercises,
  setsToday, onLogSet, onFinishExercise, isLast, nextName
}) {
  const rec = exercise.recommendation
  const baseWeight = rec?.recommended_weight ?? rec?.weight ?? null
  const [weight, setWeight] = useState(baseWeight ?? 45)
  const [selectedReps, setSelectedReps] = useState(null)
  const [logging, setLogging] = useState(false)

  useEffect(() => {
    const w = rec?.recommended_weight ?? rec?.weight ?? null
    if (w !== null) setWeight(w)
  }, [exercise.exercise_id])

  async function handleLog() {
    if (selectedReps === null) return
    setLogging(true)
    await onLogSet(weight, selectedReps)
    setSelectedReps(null)
    setLogging(false)
  }

  function adjustWeight(delta) {
    setWeight(w => Math.max(0, Math.round((w + delta) * 10) / 10))
  }

  return (
    <div className="min-h-screen bg-gray-950 px-5 py-8 flex flex-col">
      <div className="flex gap-1.5 mb-6">
        {Array.from({ length: totalExercises }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === exerciseNumber - 1
                ? 'flex-1 bg-blue-500'
                : i < exerciseNumber - 1
                ? 'w-6 bg-blue-900'
                : 'w-6 bg-gray-800'
            }`}
          />
        ))}
      </div>

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {templateName} · {exerciseNumber} of {totalExercises}
      </p>
      <h1 className="text-3xl font-bold text-white mb-6">{exercise.name}</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
        {rec?.note && (
          <p className="text-xs text-blue-400 text-center mb-4">{rec.note}</p>
        )}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => adjustWeight(-2.5)}
            className="w-14 h-14 rounded-xl bg-gray-800 text-white text-2xl font-light active:scale-95 transition"
          >
            −
          </button>
          <div className="text-center">
            <div className="text-5xl font-bold text-white">{weight}</div>
            <div className="text-xs text-gray-500 mt-1">lbs · target 5–8 reps</div>
          </div>
          <button
            onClick={() => adjustWeight(2.5)}
            className="w-14 h-14 rounded-xl bg-gray-800 text-white text-2xl font-light active:scale-95 transition"
          >
            +
          </button>
        </div>
      </div>

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Reps
      </p>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setSelectedReps(n)}
            className={`py-3.5 rounded-xl border text-sm font-semibold transition active:scale-95 ${
              selectedReps === n
                ? 'bg-blue-600 border-blue-600 text-white'
                : n >= 5 && n <= 8
                ? 'border-blue-800 text-blue-400 bg-gray-900'
                : 'border-gray-800 text-gray-500 bg-gray-900'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        onClick={handleLog}
        disabled={selectedReps === null || logging}
        className="w-full bg-blue-600 text-white font-semibold rounded-xl py-4 mb-3 disabled:opacity-30 active:scale-[0.98] transition text-base"
      >
        {logging
          ? 'Logging...'
          : selectedReps
          ? `Log ${weight} lbs × ${selectedReps}`
          : 'Select reps to log'}
      </button>

      {setsToday.length > 0 && (
        <>
          <div className="mb-3">
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">
              Today's sets
            </p>
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">
              {setsToday.map((s, i) => (
                <div key={i} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-gray-500">Set {i + 1}</span>
                  <span className="font-semibold text-white">
                    {s.weight} lbs × {s.reps}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onFinishExercise}
            className="w-full bg-gray-900 border border-gray-700 text-white font-semibold rounded-xl py-4 active:scale-[0.98] transition"
          >
            {isLast ? 'Finish workout 💪' : `Next: ${nextName} →`}
          </button>
        </>
      )}
    </div>
  )
}

function DoneScreen({ onBack }) {
  return (
    <div className="min-h-screen bg-gray-950 px-5 flex flex-col items-center justify-center text-center">
      <div className="text-6xl mb-4">💪</div>
      <h1 className="text-3xl font-bold text-white mb-2">Workout done</h1>
      <p className="text-gray-500 mb-8">Nice work. See you next session.</p>
      <button
        onClick={onBack}
        className="bg-blue-600 text-white font-semibold rounded-xl px-8 py-4 active:scale-[0.98] transition"
      >
        Back to workouts
      </button>
    </div>
  )
}

export default App