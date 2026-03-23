import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  GraduationCap, 
  BookOpen, 
  Calculator, 
  Award,
  Search,
  Info,
  X
} from 'lucide-react';
import { Course, PlannedCourse, GraduationPlan, Endorsement } from './types';
import { COURSES } from './data/courses';
import { GRADUATION_PLANS, ENDORSEMENTS } from './data/requirements';

export default function App() {
  const [plannedCourses, setPlannedCourses] = useState<PlannedCourse[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('dla');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ year: PlannedCourse['year']; semester: PlannedCourse['semester'] } | null>(null);

  const selectedPlan = useMemo(() => 
    GRADUATION_PLANS.find(p => p.id === selectedPlanId) || GRADUATION_PLANS[2],
  [selectedPlanId]);

  // Calculate credits per subject and track which course is assigned to which category
  const { creditSummary, courseAssignments } = useMemo(() => {
    const summary: { [subject: string]: number } = {};
    const rawCredits: { [subject: string]: number } = {};
    const assignments: { [pcIndex: number]: string } = {};
    
    // 1. Calculate raw credits per subject from planned courses
    plannedCourses.forEach(pc => {
      const course = COURSES.find(c => c.id === pc.courseId);
      if (course) {
        rawCredits[course.subject] = (rawCredits[course.subject] || 0) + course.credits;
      }
    });

    // 2. Define core subjects that have specific requirements in the plan
    const coreSubjects = ['ELA', 'Math', 'Science', 'Social Studies', 'LOTE', 'Fine Arts', 'PE'];
    const currentCoreEarned: { [subject: string]: number } = {};
    
    // 3. Assign courses to categories
    plannedCourses.forEach((pc, index) => {
      const course = COURSES.find(c => c.id === pc.courseId);
      if (!course) return;

      const subject = course.subject;
      const required = selectedPlan.requiredCredits[subject] || 0;
      const earnedSoFar = currentCoreEarned[subject] || 0;

      if (coreSubjects.includes(subject) && earnedSoFar < required) {
        assignments[index] = subject;
        currentCoreEarned[subject] = earnedSoFar + course.credits;
        summary[subject] = (summary[subject] || 0) + course.credits;
      } else {
        assignments[index] = 'Electives';
        summary['Electives'] = (summary['Electives'] || 0) + course.credits;
      }
    });

    // Ensure all core subjects are in the summary even if 0
    coreSubjects.forEach(s => {
      if (!summary[s]) summary[s] = 0;
    });
    if (!summary['Electives']) summary['Electives'] = 0;

    return { creditSummary: summary, courseAssignments: assignments };
  }, [plannedCourses, selectedPlan]);

  const totalCredits = useMemo(() => 
    Object.values(creditSummary).reduce((acc, curr) => (acc as number) + (curr as number), 0) as number,
  [creditSummary]);

  // Calculate Endorsement Progress
  const endorsementProgress = useMemo(() => {
    const progress: { [id: string]: number } = {};
    
    const courses = plannedCourses.map(pc => COURSES.find(c => c.id === pc.courseId)).filter(Boolean) as Course[];
    const subjects = courses.reduce((acc, c) => {
      acc[c.subject] = (acc[c.subject] || 0) + c.credits;
      return acc;
    }, {} as { [s: string]: number });

    // STEM
    const hasAlg2 = courses.some(c => c.peims === '03100600');
    const hasChem = courses.some(c => c.peims === '03040000');
    const hasPhys = courses.some(c => c.peims === '03050000' || c.peims === 'A3050003');
    const stemCore = (hasAlg2 ? 1 : 0) + (hasChem ? 1 : 0) + (hasPhys ? 1 : 0);
    const stemMathSci = Math.max(subjects['Math'] || 0, subjects['Science'] || 0);
    progress['stem'] = Math.min(((stemCore / 3) * 0.6 + (Math.min(stemMathSci / 5, 1) * 0.4)) * 100, 100);

    // Business & Industry
    const cteCredits = subjects['CTE'] || 0;
    progress['business_industry'] = Math.min((cteCredits / 4) * 100, 100);

    // Arts & Humanities
    const ssCredits = subjects['Social Studies'] || 0;
    const faCredits = subjects['Fine Arts'] || 0;
    const loteCredits = subjects['LOTE'] || 0;
    const artsProgress = Math.max(
      (ssCredits / 5),
      (faCredits / 4),
      (loteCredits / 4)
    );
    progress['arts_humanities'] = Math.min(artsProgress * 100, 100);

    // Public Service
    const psCte = courses.filter(c => 
      c.subject === 'CTE' && 
      (c.name.includes('Health') || c.name.includes('Medical') || c.name.includes('Law') || c.name.includes('Education'))
    ).reduce((acc, c) => acc + c.credits, 0);
    progress['public_service'] = Math.min((psCte / 4) * 100, 100);

    // Multidisciplinary
    const advCourses = courses.filter(c => c.level === 'AP' || c.level === 'Advanced').length;
    const foundationMet = ['ELA', 'Math', 'Science', 'Social Studies'].every(s => (subjects[s] || 0) >= 4);
    const multiProgress = Math.max(
      (advCourses / 4),
      (foundationMet ? 1 : 0)
    );
    progress['multidisciplinary'] = Math.min(multiProgress * 100, 100);

    return progress;
  }, [plannedCourses]);

  // Prerequisite check
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    plannedCourses.forEach(pc => {
      const course = COURSES.find(c => c.id === pc.courseId);
      if (course?.prerequisites) {
        course.prerequisites.forEach(preId => {
          const preCourse = COURSES.find(c => c.id === preId);
          if (!preCourse) return;

          const isMet = plannedCourses.some(otherPc => {
            const otherCourse = COURSES.find(c => c.id === otherPc.courseId);
            if (!otherCourse) return false;

            // Match by PEIMS code to allow Regular/Advanced/AP versions to satisfy prerequisites
            if (otherCourse.peims !== preCourse.peims) return false;

            // Prerequisite must be taken in an earlier year or same year earlier semester
            const yearOrder = ['MiddleSchool', 'Summer', 'Freshman', 'Sophomore', 'Junior', 'Senior'];
            const pcYearIndex = yearOrder.indexOf(pc.year);
            const otherYearIndex = yearOrder.indexOf(otherPc.year);
            
            if (otherYearIndex < pcYearIndex && otherYearIndex !== -1) return true;
            if (otherYearIndex === pcYearIndex && otherYearIndex !== -1) {
              // In Middle School or Summer, we assume courses can be taken sequentially even if both are full-year
              if (pc.year === 'MiddleSchool' || pc.year === 'Summer') return true;
              if (pc.semester === 'B' && otherPc.semester === 'A') return true;
            }
            return false;
          });
          if (!isMet) {
            errors.push(`${course.name} requires ${preCourse.name} (or equivalent) as a prerequisite.`);
          }
        });
      }
    });
    return errors;
  }, [plannedCourses]);

  const addCourse = (courseId: string) => {
    if (!activeSlot) return;
    
    const course = COURSES.find(c => c.id === courseId);
    if (!course) return;

    // Default to 'Both' if credit > 0.5, otherwise use the selected semester
    const semesterToSet: PlannedCourse['semester'] = course.credits > 0.5 ? 'Both' : activeSlot.semester;

    // Check if course already added in this year
    if (plannedCourses.some(pc => pc.courseId === courseId && pc.year === activeSlot.year)) {
      return;
    }

    setPlannedCourses([...plannedCourses, { 
      courseId, 
      year: activeSlot.year, 
      semester: semesterToSet 
    }]);
    setIsModalOpen(false);
    setActiveSlot(null);
  };

  const removeCourse = (courseId: string, year: PlannedCourse['year']) => {
    setPlannedCourses(plannedCourses.filter(pc => 
      !(pc.courseId === courseId && pc.year === year)
    ));
  };

  const filteredCourses = useMemo(() => {
    return COURSES.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.subject.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const getCategoryColor = (category: string | undefined) => {
    switch (category) {
      case 'ELA': return 'bg-blue-500';
      case 'Math': return 'bg-emerald-500';
      case 'Science': return 'bg-amber-500';
      case 'Social Studies': return 'bg-purple-500';
      case 'LOTE': return 'bg-rose-500';
      case 'Fine Arts': return 'bg-pink-500';
      case 'PE': return 'bg-orange-500';
      case 'Electives': return 'bg-slate-500';
      default: return 'bg-slate-400';
    }
  };

  const getCategoryLightColor = (category: string | undefined) => {
    switch (category) {
      case 'ELA': return 'bg-blue-50 border-blue-100 text-blue-900 hover:border-blue-300';
      case 'Math': return 'bg-emerald-50 border-emerald-100 text-emerald-900 hover:border-emerald-300';
      case 'Science': return 'bg-amber-50 border-amber-100 text-amber-900 hover:border-amber-300';
      case 'Social Studies': return 'bg-purple-50 border-purple-100 text-purple-900 hover:border-purple-300';
      case 'LOTE': return 'bg-rose-50 border-rose-100 text-rose-900 hover:border-rose-300';
      case 'Fine Arts': return 'bg-pink-50 border-pink-100 text-pink-900 hover:border-pink-300';
      case 'PE': return 'bg-orange-50 border-orange-100 text-orange-900 hover:border-orange-300';
      case 'Electives': return 'bg-slate-50 border-slate-200 text-slate-900 hover:border-slate-300';
      default: return 'bg-slate-50 border-slate-100 text-slate-900';
    }
  };

  const renderYear = (year: PlannedCourse['year'], title: string) => {
    const yearCourses = plannedCourses.map((pc, index) => ({ pc, index })).filter(item => item.pc.year === year);
    const fullYearCourses = yearCourses.filter(item => item.pc.semester === 'Both');
    const semACourses = yearCourses.filter(item => item.pc.semester === 'A');
    const semBCourses = yearCourses.filter(item => item.pc.semester === 'B');

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full" id={`year-${year}`}>
        <div className="bg-slate-50 px-4 py-3 border-bottom border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" />
            {title}
          </h3>
          <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
            {yearCourses.reduce((acc, item) => acc + (COURSES.find(c => c.id === item.pc.courseId)?.credits || 0), 0)} Credits
          </span>
        </div>
        
        <div className="p-4 flex flex-col gap-4 flex-grow">
          {/* Full Year Courses */}
          {fullYearCourses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Full Year</h4>
              <div className="grid grid-cols-1 gap-2">
                {fullYearCourses.map(({ pc, index }) => {
                  const course = COURSES.find(c => c.id === pc.courseId);
                  const assignedCategory = courseAssignments[index];
                  return (
                    <div key={`${pc.courseId}-${index}`} className={`group relative p-3 rounded-xl border transition-all ${getCategoryLightColor(assignedCategory)}`} id={`course-${pc.courseId}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-bold leading-tight">{course?.name}</p>
                          <p className="text-[10px] mt-1 flex items-center gap-1 font-medium opacity-70">
                            <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(assignedCategory)}`}></span>
                            Counted as {assignedCategory} • {course?.credits} Credit
                          </p>
                        </div>
                        <button 
                          onClick={() => removeCourse(pc.courseId, year)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Semester A */}
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semester A</h4>
                <button 
                  onClick={() => { setActiveSlot({ year, semester: 'A' }); setIsModalOpen(true); }}
                  className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                  id={`add-btn-${year}-A`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {semACourses.map(({ pc, index }) => {
                  const course = COURSES.find(c => c.id === pc.courseId);
                  const assignedCategory = courseAssignments[index];
                  return (
                    <div key={`${pc.courseId}-${index}`} className={`group relative p-3 rounded-xl border transition-all ${getCategoryLightColor(assignedCategory)}`} id={`course-${pc.courseId}-A`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium leading-tight">{course?.name}</p>
                          <p className="text-[10px] mt-1 flex items-center gap-1 opacity-70">
                            <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(assignedCategory)}`}></span>
                            {assignedCategory} • {course?.credits} Credit
                          </p>
                        </div>
                        <button 
                          onClick={() => removeCourse(pc.courseId, year)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Semester B */}
            <div className="space-y-2 border-l border-slate-100 pl-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semester B</h4>
                <button 
                  onClick={() => { setActiveSlot({ year, semester: 'B' }); setIsModalOpen(true); }}
                  className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors"
                  id={`add-btn-${year}-B`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {semBCourses.map(({ pc, index }) => {
                  const course = COURSES.find(c => c.id === pc.courseId);
                  const assignedCategory = courseAssignments[index];
                  return (
                    <div key={`${pc.courseId}-${index}`} className={`group relative p-3 rounded-xl border transition-all ${getCategoryLightColor(assignedCategory)}`} id={`course-${pc.courseId}-B`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium leading-tight">{course?.name}</p>
                          <p className="text-[10px] mt-1 flex items-center gap-1 opacity-70">
                            <span className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(assignedCategory)}`}></span>
                            {assignedCategory} • {course?.credits} Credit
                          </p>
                        </div>
                        <button 
                          onClick={() => removeCourse(pc.courseId, year)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">RRISD Path Planner</h1>
              <p className="text-xs text-slate-500 font-medium">Round Rock Independent School District</p>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex-grow md:w-64">
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Graduation Plan</label>
              <select 
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full bg-slate-100 border-none rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all"
                id="plan-selector"
              >
                {GRADUATION_PLANS.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>
            <div className="bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
              <p className="text-[10px] font-bold text-indigo-400 uppercase">Total Credits</p>
              <p className="text-lg font-bold text-indigo-700">{totalCredits} / {selectedPlan.totalCredits}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Requirements */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Requirement Progress
            </h2>
            <div className="space-y-4">
              {Object.entries(selectedPlan.requiredCredits).map(([subject, required]) => {
                const earned = creditSummary[subject] || 0;
                const progress = Math.min(((earned as number) / (required as number)) * 100, 100);
                return (
                  <div key={subject} id={`req-${subject}`}>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-slate-600">{subject}</span>
                      <span className={earned >= required ? 'text-emerald-600' : 'text-slate-400'}>
                        {earned} / {required}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full ${earned >= required ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Endorsements
            </h2>
            <div className="space-y-4">
              {ENDORSEMENTS.map(endorsement => {
                const progress = endorsementProgress[endorsement.id] || 0;
                return (
                  <div key={endorsement.id} className="group relative" id={`endorsement-${endorsement.id}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <p className="text-xs font-bold text-slate-700">{endorsement.name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${progress >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {Math.round(progress)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full transition-colors ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 line-clamp-1 group-hover:line-clamp-none transition-all">
                      {endorsement.requirements}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {validationErrors.length > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-5">
              <h2 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Planning Alerts
              </h2>
              <ul className="space-y-2">
                {validationErrors.map((error, i) => (
                  <li key={i} className="text-[10px] text-red-600 leading-relaxed flex gap-2">
                    <span className="mt-1 w-1 h-1 bg-red-400 rounded-full flex-shrink-0"></span>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Main Content: 4-Year Grid */}
        <div className="lg:col-span-9 space-y-6">
          {/* Middle School / Prior Credits */}
          <div className="bg-indigo-900 rounded-2xl shadow-lg p-6 text-white overflow-hidden relative" id="middle-school-section">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <BookOpen className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg font-bold">Prior Credits</h2>
                  <p className="text-xs text-indigo-200">Middle School, Summer Programs, or CBE</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-indigo-300 uppercase">Prior Credits</p>
                    <p className="text-sm font-bold">
                      {plannedCourses
                        .filter(pc => pc.year === 'MiddleSchool')
                        .reduce((acc, pc) => acc + (COURSES.find(c => c.id === pc.courseId)?.credits || 0), 0)}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setActiveSlot({ year: 'MiddleSchool', semester: 'Both' }); setIsModalOpen(true); }}
                    className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                    id="add-prior-btn"
                  >
                    <Plus className="w-4 h-4" /> Add Credit
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {plannedCourses.filter(pc => pc.year === 'MiddleSchool').map(pc => {
                  const course = COURSES.find(c => c.id === pc.courseId);
                  return (
                    <div key={pc.courseId} className="bg-white/10 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 flex items-center gap-3 group" id={`prior-${pc.courseId}`}>
                      <span className="text-xs font-medium">{course?.name}</span>
                      <button 
                        onClick={() => removeCourse(pc.courseId, 'MiddleSchool')}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
                {plannedCourses.filter(pc => pc.year === 'MiddleSchool').length === 0 && (
                  <p className="text-xs text-indigo-300 italic">No prior credits added yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* High School Years */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderYear('Freshman', 'Freshman Year')}
            {renderYear('Sophomore', 'Sophomore Year')}
            {renderYear('Junior', 'Junior Year')}
            {renderYear('Senior', 'Senior Year')}
          </div>
        </div>
      </main>

      {/* Course Selection Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              id="course-modal"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Select a Course</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Adding to {activeSlot?.year} • {activeSlot?.semester === 'Both' ? 'Full Year' : `Semester ${activeSlot?.semester}`}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 bg-slate-50 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by name, subject, or PEIMS..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    autoFocus
                    id="course-search"
                  />
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-6 space-y-3">
                {filteredCourses.map(course => (
                  <button 
                    key={course.id}
                    onClick={() => addCourse(course.id)}
                    className="w-full text-left p-4 bg-white rounded-2xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group flex justify-between items-center"
                    id={`modal-course-${course.id}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{course.name}</span>
                        {course.isWeighted && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">WEIGHTED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{course.subject}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] font-medium text-slate-500">PEIMS: {course.peims}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] font-medium text-slate-500">{course.credits} Credit</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
                {filteredCourses.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">No courses found matching your search.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


