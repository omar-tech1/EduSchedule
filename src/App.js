
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  CalendarDays,
  Search,
  Plus,
  Clock,
  MapPin,
  GraduationCap,
  Users,
  X,
  Printer,
  FileSpreadsheet,
  Trash2,
  Menu,
  CircleAlert,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import "./index.css";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || "https://kfpxswcxwkghixvjzkgq.supabase.co",
  process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_s12CvvVfkWB2BDXWE2MdyA_JKdWf40q"
);

const DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "السبت",
];

const DEPARTMENTS = [
  "تكنولوجيا التعليم",
  "فنية",
  "اقتصاد منزلي",
  "موسيقى",
];

const HALLS = ["مدرج 1", "مدرج 2", "مدرج 3", "مدرج 4"];
const STUDY_YEARS = ["الأولى", "الثانية", "الثالثة", "الرابعة"];

const INITIAL_LECTURES = [
  {
    id: 1,
    name: "برمجة الويب",
    doctor: "د. أحمد محمد",
    department: "تكنولوجيا التعليم",
    hall: "مدرج 1",
    day: "الأحد",
    startTime: "09:00",
    endTime: "11:00",
  },
  {
    id: 2,
    name: "أساسيات التصميم",
    doctor: "د. منى علي",
    department: "فنية",
    hall: "مدرج 2",
    day: "الأحد",
    startTime: "11:00",
    endTime: "13:00",
  },
  {
    id: 3,
    name: "نظريات الموسيقى",
    doctor: "د. خالد حسن",
    department: "موسيقى",
    hall: "مدرج 3",
    day: "الاثنين",
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: 4,
    name: "قواعد البيانات",
    doctor: "د. أحمد محمد",
    department: "تكنولوجيا التعليم",
    hall: "مدرج 2",
    day: "الثلاثاء",
    startTime: "12:00",
    endTime: "14:00",
  },
];

const EMPTY_FORM = {
  name: "",
  doctor: "",
  department: "تكنولوجيا التعليم",
  studyYear: "الأولى",
  hall: "مدرج 1",
  day: "الأحد",
  startTime: "08:00",
  endTime: "10:00",
};

function mapDbLecture(row) {
  return {
    id: row.id,
    name: row.title,
    doctor: row.instructor || "",
    department: row.departments?.name || "تكنولوجيا التعليم",
    studyYear: row.study_year || "",
    hall: row.halls?.name || "مدرج 1",
    day: row.day_of_week || "الأحد",
    startTime: String(row.start_time || "09:00").slice(0, 5),
    endTime: String(row.end_time || "11:00").slice(0, 5),
  };
}

async function getOrCreateNamedRow(table, name) {
  const { data: existing, error: selectError } = await supabase
    .from(table).select("id,name").eq("name", name).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;
  const { data, error } = await supabase.from(table).insert({ name }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function toDbLecture(lecture) {
  const [department_id, hall_id] = await Promise.all([
    getOrCreateNamedRow("departments", lecture.department),
    getOrCreateNamedRow("halls", lecture.hall),
  ]);
  return {
    title: lecture.name.trim(),
    instructor: lecture.doctor.trim(),
    department_id,
    study_year: lecture.studyYear,
    hall_id,
    day_of_week: lecture.day,
    start_time: lecture.startTime,
    end_time: lecture.endTime,
  };
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "م" : "ص";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function App() {
  const [lectures, setLectures] = useState([]);
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("الكل");
  const [dayFilter, setDayFilter] = useState("الكل");
  const [activePage, setActivePage] = useState("نظرة عامة");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showStudentPortal, setShowStudentPortal] = useState(false);
  const [studentDepartment, setStudentDepartment] = useState(DEPARTMENTS[0]);
  const [studentYear, setStudentYear] = useState(STUDY_YEARS[0]);
  const [studentLectures, setStudentLectures] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentSearched, setStudentSearched] = useState(false);
  const [studentError, setStudentError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setDataLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setLectures([]);
      return;
    }
    let active = true;
    setDataLoading(true);
    supabase.from("lectures")
      .select("id,title,instructor,day_of_week,start_time,end_time,study_year,departments(name),halls(name)")
      .order("day_of_week").order("start_time")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setNotice({ type: "error", message: `تعذر تحميل المحاضرات: ${error.message}` });
        else setLectures((data || []).map(mapDbLecture));
        setDataLoading(false);
      });
    return () => { active = false; };
  }, [session]);

  async function signIn(event) {
    event.preventDefault();
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setNotice({ type: "error", message: `تعذر تسجيل الدخول: ${error.message}` });
    setAuthBusy(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setNotice({ type: "error", message: error.message });
  }

  async function loadStudentSchedule(event) {
    event.preventDefault();
    setStudentLoading(true);
    setStudentError("");
    setStudentSearched(true);
    const { data, error } = await supabase
      .from("lectures")
      .select("id,title,instructor,day_of_week,start_time,end_time,study_year,departments!inner(name),halls(name)")
      .eq("study_year", studentYear)
      .eq("departments.name", studentDepartment)
      .order("day_of_week")
      .order("start_time");
    if (error) {
      setStudentError(`تعذر تحميل الجدول: ${error.message}`);
      setStudentLectures([]);
    } else {
      setStudentLectures((data || []).map(mapDbLecture).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime)));
    }
    setStudentLoading(false);
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

 async  function addLecture(event) {
    event.preventDefault();
    setNotice(null);

    const start = Number(form.startTime.replace(":", ""));
    const end = Number(form.endTime.replace(":", ""));

    if (start < 800 || end > 1800) {
      setNotice({
        type: "error",
        message: "مواعيد المحاضرات لازم تكون بين 8 صباحًا و6 مساءً.",
      });
      return;
    }

    if (end <= start) {
      setNotice({
        type: "error",
        message: "وقت النهاية لازم يكون بعد وقت البداية.",
      });
      return;
    }

    const  conflict = lectures.find((lecture) => {
      if (lecture.day !== form.day || lecture.hall !== form.hall) {
        return false;
      }

      return (
        form.startTime < lecture.endTime &&
        form.endTime > lecture.startTime
      );
    });

    if (conflict) {
      setNotice({
        type: "error",
        message: `${conflict.hall} محجوز بالفعل يوم ${conflict.day} من ${formatTime(conflict.startTime)} إلى ${formatTime(conflict.endTime)} لمحاضرة "${conflict.name}". اختار وقتًا آخر أو مدرجًا مختلفًا.`,
      });
      return;
    }

    try {
      const payload = await toDbLecture (form);
      const { data, error } = await supabase.from("lectures").insert(payload)
        .select("id,title,instructor,day_of_week,start_time,end_time,study_year,departments(name),halls(name)").single();
      if (error) throw error;
      setLectures((previous) => [...previous, mapDbLecture(data)]);
      setNotice({ type: "success", message: "تمت إضافة المحاضرة وحفظها في قاعدة البيانات." });
      closeForm();
    } catch (error) {
      const message = error.code === "23P01" || String(error.message).includes("HALL_TIME_CONFLICT")
        ? "المدرج محجوز بالفعل في هذا اليوم والوقت. اختار وقتًا أو مدرجًا آخر."
        : `تعذر حفظ المحاضرة: ${error.message}`;
      setNotice({ type: "error", message });
    }
  }

  async function deleteLecture(id) {
    const lecture = lectures.find((item) => item.id === id);
    if (!lecture) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف محاضرة "${lecture.name}"؟`
    );

    if (!confirmed) return;

    setLectures((previous) =>
      previous.filter((item) => item.id !== id)
    );

    setNotice({
      type: "success",
      message: `تم حذف محاضرة "${lecture.name}" بنجاح.`,
    });
  }

  const filteredLectures = lectures
    .filter((lecture) => {
      const searchValue = search.trim().toLowerCase();

      const matchesSearch =
        lecture.name.toLowerCase().includes(searchValue) ||
        lecture.doctor.toLowerCase().includes(searchValue) ||
        lecture.hall.toLowerCase().includes(searchValue);

      const matchesDepartment =
        departmentFilter === "الكل" ||
        lecture.department === departmentFilter;

      const matchesDay =
        dayFilter === "الكل" || lecture.day === dayFilter;

      return matchesSearch && matchesDepartment && matchesDay;
    })
    .sort(
      (a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
        a.startTime.localeCompare(b.startTime)
    );

  function exportLectures() {
    const headers = [
      "اسم المحاضرة",
      "اسم الدكتور",
      "القسم",
      "المدرج",
      "اليوم",
      "وقت البداية",
      "وقت النهاية",
    ];

    const rows = filteredLectures.map((lecture) => [
      lecture.name,
      lecture.doctor,
      lecture.department,
      lecture.hall,
      lecture.day,
      lecture.startTime,
      lecture.endTime,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "university-lectures.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const departmentsCount = new Set(
    lectures.map((lecture) => lecture.department)
  ).size;

  const hallsCount = new Set(
    lectures.map((lecture) => lecture.hall)
  ).size;

  function editLecture(lecture) {
    setForm({
      name: lecture.name,
      doctor: lecture.doctor,
      department: lecture.department,
      studyYear: lecture.studyYear || "الأولى",
      hall: lecture.hall,
      day: lecture.day,
      startTime: lecture.startTime,
      endTime: lecture.endTime,
    });

    setEditingId(lecture.id);
    setNotice(null);
    setShowForm(true);
  }

  async function saveLecture(event) {
    event.preventDefault();
    setNotice(null);

    const start = Number(form.startTime.replace(":", ""));
    const end = Number(form.endTime.replace(":", ""));

    if (start < 800 || end > 1800) {
      setNotice({
        type: "error",
        message: "المواعيد لازم تكون بين 8 صباحًا و6 مساءً.",
      });
      return;
    }

    if (end <= start) {
      setNotice({
        type: "error",
        message: "وقت النهاية لازم يكون بعد وقت البداية.",
      });
      return;
    }

    const conflict = lectures.find((lecture) => {
      if (lecture.id === editingId) return false;

      if (lecture.day !== form.day || lecture.hall !== form.hall) {
        return false;
      }

      return (
        form.startTime < lecture.endTime &&
        form.endTime > lecture.startTime
      );
    });

    if (conflict) {
      setNotice({
        type: "error",
        message: `المدرج محجوز يوم ${conflict.day} من ${formatTime(conflict.startTime)} إلى ${formatTime(conflict.endTime)} لمحاضرة "${conflict.name}".`,
      });
      return;
    }

    try {
      const payload = await toDbLecture(form);
      const { data, error } = await supabase.from("lectures").update(payload).eq("id", editingId)
        .select("id,title,instructor,day_of_week,start_time,end_time,study_year,departments(name),halls(name)").single();
      if (error) throw error;
      setLectures((previous) => previous.map((lecture) => lecture.id === editingId ? mapDbLecture(data) : lecture));
      setNotice({ type: "success", message: "تم تعديل المحاضرة وحفظ التغييرات." });
      closeForm();
    } catch (error) {
      const message = error.code === "23P01" || String(error.message).includes("HALL_TIME_CONFLICT")
        ? "المدرج محجوز بالفعل في هذا اليوم والوقت. اختار وقتًا أو مدرجًا آخر."
        : `تعذر تعديل المحاضرة: ${error.message}`;
      setNotice({ type: "error", message });
    }
  }
  
  if (dataLoading && !session) {
    return <div className="app-shell" dir="rtl"><main className="main-content"><h2>جارٍ الاتصال بقاعدة البيانات...</h2></main></div>;
  }

  if (!session && showStudentPortal) {
    return (
      <div className="app-shell student-portal" dir="rtl">
        <main className="student-main">
          <header className="student-header"><div className="student-brand-icon"><GraduationCap size={28} /></div><div><h1>EduSchedule</h1><p>بوابة الطالب — جدول محاضراتك</p></div></header>
          <section className="student-card"><p className="eyebrow">بوابة الطلاب</p><h2>اعرف جدولك الدراسي</h2><p className="student-description">اختار القسم والفرقة علشان تعرض المحاضرات الخاصة بيك.</p>
            <form className="student-select-form" onSubmit={loadStudentSchedule}>
              <label className="form-field"><span>القسم</span><select value={studentDepartment} onChange={(e) => { setStudentDepartment(e.target.value); setStudentSearched(false); }}>{DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
              <label className="form-field"><span>الفرقة الدراسية</span><select value={studentYear} onChange={(e) => { setStudentYear(e.target.value); setStudentSearched(false); }}>{STUDY_YEARS.map((year) => <option key={year} value={year}>الفرقة {year}</option>)}</select></label>
              <button className="primary-button student-submit" type="submit" disabled={studentLoading}><CalendarDays size={18} />{studentLoading ? "جارٍ تحميل الجدول..." : "عرض الجدول"}</button>
            </form>
            {studentError && <div className="notice error" role="alert">{studentError}</div>}
            {studentSearched && !studentLoading && !studentError && <section className="student-results"><div className="student-results-heading"><div><h3>جدول {studentDepartment} — الفرقة {studentYear}</h3><span>{studentLectures.length} محاضرة</span></div>{studentLectures.length > 0 && <button className="primary-button student-print-button" type="button" onClick={() => window.print()}><Printer size={17} /> طباعة الجدول</button>}</div>
              {studentLectures.length ? <div className="table-container"><table className="lectures-table student-table"><thead><tr><th>المادة</th><th>الدكتور</th><th>اليوم</th><th>التوقيت</th><th>المدرج</th></tr></thead><tbody>{studentLectures.map((lecture) => <tr key={lecture.id}><td data-label="المادة"><strong>{lecture.name}</strong></td><td data-label="الدكتور">{lecture.doctor || "—"}</td><td data-label="اليوم">{lecture.day}</td><td data-label="التوقيت">{formatTime(lecture.startTime)} – {formatTime(lecture.endTime)}</td><td data-label="المدرج"><span className="hall-cell"><MapPin size={15} />{lecture.hall}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><CalendarDays size={30} /><strong>لسه مفيش جدول للفرقة دي</strong><p>المسؤول لسه ما أضافش محاضرات للفرقة دي.</p></div>}
            </section>}
            <button className="student-back-button" type="button" onClick={() => { setShowStudentPortal(false); setStudentSearched(false); setStudentError(""); }}>العودة لتسجيل دخول المسؤول</button>
          </section><p className="student-footnote">EduSchedule · نظام الجدولة الجامعية</p>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-shell" dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <form onSubmit={signIn} style={{ width: "min(420px, 100%)", padding: 28, background: "#0E131B", border: "1px solid #252C36", borderRadius: 16, boxShadow: "0 24px 70px #0008" }}>
          <div style={{ color: "#EF1D2A", fontSize: 32, textAlign: "center" }}><GraduationCap size={36} /></div>
          <h1 style={{ textAlign: "center", margin: "8px 0" }}>University Schedule</h1>
          <p style={{ textAlign: "center", opacity: .75, marginBottom: 24 }}>سجّل الدخول لإدارة جدول المحاضرات</p>
          {notice && <p role="alert" style={{ color: "#ff6872" }}>{notice.message}</p>}
          <label style={{ display: "block", marginBottom: 8 }}>البريد الإلكتروني</label>
          <input type="email" required autoComplete="username" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="admin@university.edu" style={{ width: "100%", boxSizing: "border-box", marginBottom: 16, padding: 12, borderRadius: 8, background: "#080B10", color: "white", border: "1px solid #252C36" }} />
          <label style={{ display: "block", marginBottom: 8 }}>كلمة المرور</label>
          <input type="password" required autoComplete="current-password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", boxSizing: "border-box", marginBottom: 20, padding: 12, borderRadius: 8, background: "#080B10", color: "white", border: "1px solid #252C36" }} />
          <button type="submit" disabled={authBusy} className="primary-button" style={{ width: "100%", justifyContent: "center" }}>{authBusy ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}</button>
          <p style={{ fontSize: 12, opacity: .65, marginTop: 16, lineHeight: 1.8 }}>يجب إنشاء حساب المدير من Supabase Dashboard → Authentication → Users أولًا.</p>
          <button type="button" className="student-entry-button" onClick={() => setShowStudentPortal(true)}><GraduationCap size={18} /> أنا طالب — عرض الجدول</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-shell" dir="rtl">
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <GraduationCap size={26} />
          </div>
          <div>
            <h2>EduSchedule</h2>
            <span>نظام إدارة المحاضرات</span>
          </div>
          <button
            className="icon-button close-sidebar"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">القائمة الرئيسية</div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activePage === "نظرة عامة" ? "active" : ""}`}
            onClick={() => {
              setActivePage("نظرة عامة");
              setMobileMenuOpen(false);
            }}
          >
            <LayoutDashboard size={19} />
            <span>نظرة عامة</span>
          </button>

          <button
            className={`nav-item ${activePage === "المحاضرات" ? "active" : ""}`}
            onClick={() => {
              setActivePage("المحاضرات");
              setMobileMenuOpen(false);
            }}
          >
            <CalendarDays size={19} />
            <span>جدول المحاضرات</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">
            <GraduationCap size={22} />
          </div>
          <strong>إدارة أسهل لوقتك</strong>
          <p>نظّم المحاضرات وتابع حجز المدرجات من مكان واحد.</p>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="إغلاق القائمة"
        />
      )}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-right">
            <button
              className="icon-button menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu size={22} />
            </button>

            <div>
              <div className="breadcrumb">الرئيسية / {activePage}</div>
              <h1>{activePage}</h1>
            </div>
          </div>

          <div className="topbar-left">
            <div className="user-avatar">م</div>
            <div className="user-info">
              <strong>مسؤول النظام</strong>
              <span>إدارة الكلية</span>
            </div>
          </div>
        </header>

        <section className="page-content">
          {notice && (
            <div
              className={`notice ${notice.type}`}
              role="status"
              aria-live="polite"
            >
              {notice.type === "error" ? (
                <CircleAlert size={20} />
              ) : (
                <CheckCircle2 size={20} />
              )}
              <span>{notice.message}</span>
              <button
                className="icon-button"
                onClick={() => setNotice(null)}
                aria-label="إغلاق التنبيه"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <section className="welcome-section">
            <div>
              <p className="eyebrow">نظام الجدولة الجامعية</p>
              <h2>
                أهلاً بيك في <span>EduSchedule</span>
              </h2>
              <p className="welcome-description">
                تابع المحاضرات ونظّم مواعيد القاعات بسهولة.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setEditingId(null);
                setNotice(null);
                setShowForm(true);
              }}
            >
              <Plus size={19} />
              إضافة محاضرة
            </button>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-icon purple">
                <CalendarDays size={23} />
              </div>
              <div className="stat-text">
                <span>إجمالي المحاضرات</span>
                <strong>{lectures.length}</strong>
                <small>محاضرة مسجلة</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon blue">
                <GraduationCap size={23} />
              </div>
              <div className="stat-text">
                <span>الأقسام النشطة</span>
                <strong>{departmentsCount}</strong>
                <small>أقسام لديها محاضرات</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon green">
                <MapPin size={23} />
              </div>
              <div className="stat-text">
                <span>المدرجات المستخدمة</span>
                <strong>{hallsCount}</strong>
                <small>مدرجات مسجلة</small>
              </div>
            </article>

            <article className="stat-card">
              <div className="stat-icon orange">
                <Users size={23} />
              </div>
              <div className="stat-text">
                <span>أعضاء هيئة التدريس</span>
                <strong>
                  {new Set(lectures.map((lecture) => lecture.doctor)).size}
                </strong>
                <small>دكاترة مسجلون</small>
              </div>
            </article>
          </section>

          <section className="schedule-section">
            <div className="section-heading">
              <div>
                <h2>
                  <CalendarDays size={21} />
                  جدول المحاضرات
                </h2>
                <p>عرض وإدارة المحاضرات المسجلة في النظام</p>
              </div>

              <div className="heading-actions">
                <button
                  className="secondary-button"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                  طباعة
                </button>

                <button
                  className="secondary-button"
                  onClick={exportLectures}
                >
                  <FileSpreadsheet size={17} />
                  تصدير CSV
                </button>
              </div>
            </div>

            <div className="filters-row">
              <label className="search-box">
                <Search size={19} />
                <input
                  type="search"
                  placeholder="ابحث باسم المحاضرة أو الدكتور أو المدرج..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="clear-search"
                    onClick={() => setSearch("")}
                    aria-label="مسح البحث"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>

              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                aria-label="فلترة حسب القسم"
              >
                <option value="الكل">كل الأقسام</option>
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>

              <select
                value={dayFilter}
                onChange={(event) => setDayFilter(event.target.value)}
                aria-label="فلترة حسب اليوم"
              >
                <option value="الكل">كل الأيام</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-container">
              <table className="lectures-table">
                <thead>
                  <tr>
                    <th>المحاضرة</th>
                    <th>الدكتور</th>
                    <th>القسم</th>
                    <th>المدرج</th>
                    <th>اليوم</th>
                    <th>التوقيت</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLectures.map((lecture) => (
                    <tr key={lecture.id}>
                      <td>
                        <div className="lecture-name">
                          <span className="lecture-dot" />
                          <strong>{lecture.name}</strong>
                        </div>
                      </td>

                      <td>{lecture.doctor}</td>

                      <td>
                        <span className="department-badge">
                          {lecture.department}
                        </span>
                      </td>

                      <td>
                        <span className="hall-cell">
                          <MapPin size={15} />
                          {lecture.hall}
                        </span>
                      </td>

                      <td>{lecture.day}</td>

                      <td>
                        <span className="time-cell">
                          <Clock size={15} />
                          {formatTime(lecture.startTime)} –{" "}
                          {formatTime(lecture.endTime)}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button edit-action"
                            onClick={() => editLecture(lecture)}
                            title="تعديل المحاضرة"
                            aria-label={`تعديل ${lecture.name}`}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            className="icon-button delete-action"
                            onClick={() => deleteLecture(lecture.id)}
                            title="حذف المحاضرة"
                            aria-label={`حذف ${lecture.name}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredLectures.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <Search size={30} />
                          <strong>مفيش محاضرات مطابقة</strong>
                          <p>جرّب تغيّر كلمات البحث أو الفلاتر.</p>
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setSearch("");
                              setDepartmentFilter("الكل");
                              setDayFilter("الكل");
                            }}
                          >
                            مسح الفلاتر
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="table-footer">
              <span>
                عرض <strong>{filteredLectures.length}</strong> من{" "}
                <strong>{lectures.length}</strong> محاضرة
              </span>
              <span className="footer-status">
                <span className="status-dot" />
                البيانات محفوظة على هذا الجهاز
              </span>
            </footer>
          </section>
        </section>
      </main>

      {showForm && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            className="lecture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <header className="modal-header">
              <div>
                <h2 id="modal-title">
                  {editingId ? "تعديل المحاضرة" : "إضافة محاضرة جديدة"}
                </h2>
                <p>اكتب بيانات المحاضرة وحدد موعدها والمدرج.</p>
              </div>

              <button
                className="icon-button"
                onClick={closeForm}
                aria-label="إغلاق النافذة"
              >
                <X size={21} />
              </button>
            </header>

            <form
              className="lecture-form"
              onSubmit={editingId ? saveLecture : addLecture}
            >
              <label className="form-field">
                <span>اسم المحاضرة *</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  placeholder="مثال: برمجة الويب"
                  required
                />
              </label>

              <label className="form-field">
                <span>اسم الدكتور *</span>
                <input
                  name="doctor"
                  value={form.doctor}
                  onChange={updateForm}
                  placeholder="اسم عضو هيئة التدريس"
                  required
                />
              </label>

              <div className="form-grid">
                <label className="form-field">
                  <span>القسم *</span>
                  <select
                    name="department"
                    value={form.department}
                    onChange={updateForm}
                    required
                  >
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>الفرقة الدراسية *</span>
                  <select name="studyYear" value={form.studyYear} onChange={updateForm} required>{STUDY_YEARS.map((year) => <option key={year} value={year}>الفرقة {year}</option>)}</select>
                </label>
                <label className="form-field">
                  <span>المدرج *</span>
                  <select
                    name="hall"
                    value={form.hall}
                    onChange={updateForm}
                    required
                  >
                    {HALLS.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>اليوم *</span>
                  <select
                    name="day"
                    value={form.day}
                    onChange={updateForm}
                    required
                  >
                    {DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>وقت البداية *</span>
                  <input
                    type="time"
                    name="startTime"
                    min="08:00"
                    max="18:00"
                    value={form.startTime}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>وقت النهاية *</span>
                  <input
                    type="time"
                    name="endTime"
                    min="08:00"
                    max="18:00"
                    value={form.endTime}
                    onChange={updateForm}
                    required
                  />
                </label>
              </div>

           {notice && (
  <div
    className={`notice ${notice.type}`}
    role="alert"
    aria-live="assertive"
  >
    {notice.type === "error" ? (
      <CircleAlert size={20} />
    ) : (
      <CheckCircle2 size={20} />
    )}

    <span>{notice.message}</span>
  </div>
)}

<div className="form-note">
  <CircleAlert size={17} />
  النظام هيتأكد إن المدرج مش محجوز في نفس التوقيت.
</div>

              <footer className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeForm}
                >
                  إلغاء
                </button>

                <button type="submit" className="primary-button">
                  <CheckCircle2 size={18} />
                  {editingId ? "حفظ التعديلات" : "إضافة المحاضرة"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

