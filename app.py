from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from functools import wraps
import os
from dotenv import load_dotenv

load_dotenv()   # loads DATABASE_URL (and other vars) from .env when present

def _db_url():
    """Return a SQLAlchemy-compatible PostgreSQL URL.
    Accepts DATABASE_URL from the environment (Heroku / Railway / Render style).
    Falls back to a local PostgreSQL DB called 'ticketflow'.
    """
    url = os.environ.get(
        'DATABASE_URL',
        'postgresql://postgres:postgres@localhost:5432/ticketflow'
    )
    # Some platforms (Heroku) still emit 'postgres://' — SQLAlchemy 2.x requires 'postgresql://'
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    return url

app = Flask(__name__)
app.config['SECRET_KEY']                  = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
app.config['SQLALCHEMY_DATABASE_URI']     = _db_url()
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE']    = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY']    = True
app.config['SESSION_COOKIE_SECURE']      = False   # True in production with HTTPS

CORS(app, supports_credentials=True, origins=['http://localhost:5173'])

socketio = SocketIO(
    app,
    cors_allowed_origins=['http://localhost:5173'],
    manage_session=False,
    async_mode='threading',
    logger=False,
    engineio_logger=False,
)

db           = SQLAlchemy(app)
login_manager = LoginManager(app)


# ── Unauthorized JSON handler ─────────────────────────────────────────────────

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Authentication required'}), 401


# ── Models ────────────────────────────────────────────────────────────────────

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    id              = db.Column(db.Integer, primary_key=True)
    username        = db.Column(db.String(80), unique=True, nullable=False)
    email           = db.Column(db.String(120), unique=True, nullable=False)
    password_hash   = db.Column(db.String(255), nullable=False)
    role            = db.Column(db.String(20), default='user')   # user | it_support | admin
    is_active_user  = db.Column(db.Boolean, default=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    tickets_created  = db.relationship('Ticket', foreign_keys='Ticket.created_by_id',
                                        backref='creator', lazy='dynamic')
    tickets_assigned = db.relationship('Ticket', foreign_keys='Ticket.assigned_to_id',
                                        backref='assignee', lazy='dynamic')
    comments         = db.relationship('Comment', backref='author', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def initials(self):
        parts = self.username.split()
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        return self.username[:2].upper()


class Ticket(db.Model):
    __tablename__ = 'tickets'
    id              = db.Column(db.Integer, primary_key=True)
    ticket_id       = db.Column(db.String(20), unique=True, nullable=False)
    title           = db.Column(db.String(200), nullable=False)
    description     = db.Column(db.Text, nullable=False)
    status          = db.Column(db.String(20), default='Open')
    priority        = db.Column(db.String(20), default='Medium')
    category        = db.Column(db.String(50), default='General')
    created_by_id   = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_to_id  = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at      = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_deleted      = db.Column(db.Boolean, default=False, nullable=False)
    is_archived     = db.Column(db.Boolean, default=False, nullable=False)

    comments = db.relationship('Comment', backref='ticket', lazy='dynamic',
                                cascade='all, delete-orphan', order_by='Comment.created_at')

    STATUS_CHOICES   = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']
    PRIORITY_CHOICES = ['Low', 'Medium', 'High', 'Critical']
    CATEGORY_CHOICES = ['General', 'Bug', 'Feature Request', 'Support', 'Security',
                        'Performance', 'Documentation', 'Other']


class Comment(db.Model):
    __tablename__ = 'comments'
    id         = db.Column(db.Integer, primary_key=True)
    content    = db.Column(db.Text, nullable=False)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ActivityLog(db.Model):
    __tablename__ = 'activity_logs'
    id         = db.Column(db.Integer, primary_key=True)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action     = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    ticket = db.relationship('Ticket', backref='logs')
    user   = db.relationship('User',   backref='logs')


class Notification(db.Model):
    __tablename__ = 'notifications'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    type       = db.Column(db.String(50), nullable=False)   # 'assigned' | 'resolved'
    message    = db.Column(db.String(500), nullable=False)
    is_read    = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    recipient = db.relationship('User',   foreign_keys=[user_id])
    ticket    = db.relationship('Ticket', foreign_keys=[ticket_id])


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'
    id         = db.Column(db.Integer, primary_key=True)
    ticket_id  = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content    = db.Column(db.Text, nullable=False)
    is_system  = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship('User',   foreign_keys=[user_id])
    ticket = db.relationship('Ticket', foreign_keys=[ticket_id])


class ChatParticipant(db.Model):
    __tablename__ = 'chat_participants'
    id          = db.Column(db.Integer, primary_key=True)
    ticket_id   = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    added_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('ticket_id', 'user_id', name='uq_chat_participant'),)

    user     = db.relationship('User',   foreign_keys=[user_id])
    added_by = db.relationship('User',   foreign_keys=[added_by_id])
    ticket   = db.relationship('Ticket', foreign_keys=[ticket_id])


class Conversation(db.Model):
    __tablename__ = 'conversations'
    id            = db.Column(db.Integer, primary_key=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    created_by = db.relationship('User', foreign_keys=[created_by_id])


class ConversationMember(db.Model):
    __tablename__ = 'conversation_members'
    id              = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    joined_at       = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('conversation_id', 'user_id', name='uq_conv_member'),)

    user = db.relationship('User', foreign_keys=[user_id])


class DirectMessage(db.Model):
    __tablename__ = 'direct_messages'
    id              = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False)
    user_id         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content         = db.Column(db.Text, nullable=False)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    author = db.relationship('User', foreign_keys=[user_id])


# ── Serializers ───────────────────────────────────────────────────────────────

ROLE_DISPLAY = {'user': 'User', 'it_support': 'IT Support', 'admin': 'Administrator'}

def role_label(role):
    return ROLE_DISPLAY.get(role, role.replace('_', ' ').title())

def utc_iso(dt):
    """Return an ISO-8601 string with a trailing 'Z' so browsers parse it as UTC."""
    if dt is None:
        return None
    return dt.isoformat() + 'Z'

def serialize_user(user, include_email=False):
    d = {
        'id':             user.id,
        'username':       user.username,
        'role':           user.role,
        'role_label':     role_label(user.role),
        'initials':       user.initials,
        'is_active_user': user.is_active_user,
        'created_at':     utc_iso(user.created_at),
    }
    if include_email:
        d['email'] = user.email
    return d

def serialize_ticket(ticket):
    status_color = {
        'Open': 'blue', 'In Progress': 'amber', 'Under Review': 'purple',
        'Resolved': 'green', 'Closed': 'slate'
    }.get(ticket.status, 'slate')
    priority_color = {
        'Low': 'green', 'Medium': 'blue', 'High': 'orange', 'Critical': 'red'
    }.get(ticket.priority, 'slate')
    return {
        'id':             ticket.id,
        'ticket_id':      ticket.ticket_id,
        'title':          ticket.title,
        'description':    ticket.description,
        'status':         ticket.status,
        'priority':       ticket.priority,
        'category':       ticket.category,
        'status_color':   status_color,
        'priority_color': priority_color,
        'created_by':     serialize_user(ticket.creator),
        'assigned_to':    serialize_user(ticket.assignee) if ticket.assignee else None,
        'comment_count':  ticket.comments.count(),
        'created_at':     utc_iso(ticket.created_at),
        'updated_at':     utc_iso(ticket.updated_at),
        'is_archived':    ticket.is_archived,
        'is_deleted':     ticket.is_deleted,
    }

def serialize_comment(comment):
    return {
        'id':         comment.id,
        'content':    comment.content,
        'author':     serialize_user(comment.author),
        'created_at': utc_iso(comment.created_at),
    }

def serialize_log(log):
    return {
        'id':         log.id,
        'action':     log.action,
        'user':       serialize_user(log.user),
        'created_at': utc_iso(log.created_at),
    }

def paginate_response(pagination, items_key, serializer):
    return jsonify({
        items_key: [serializer(i) for i in pagination.items],
        'pagination': {
            'page':     pagination.page,
            'pages':    pagination.pages,
            'per_page': pagination.per_page,
            'total':    pagination.total,
            'has_prev': pagination.has_prev,
            'has_next': pagination.has_next,
            'prev_num': pagination.prev_num,
            'next_num': pagination.next_num,
        }
    })


# ── Helpers / Decorators ──────────────────────────────────────────────────────

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def generate_ticket_id():
    last = Ticket.query.order_by(Ticket.id.desc()).first()
    num  = (last.id + 1) if last else 1
    return f'TKT-{num:05d}'

def serialize_notification(n):
    return {
        'id':           n.id,
        'type':         n.type,
        'ticket_id':    n.ticket.ticket_id,
        'ticket_title': n.ticket.title,
        'message':      n.message,
        'is_read':      n.is_read,
        'created_at':   utc_iso(n.created_at),
    }

def serialize_chat_message(m):
    return {
        'id':         m.id,
        'content':    m.content,
        'is_system':  m.is_system,
        'created_at': utc_iso(m.created_at),
        'author': {
            'id':         m.author.id,
            'username':   m.author.username,
            'initials':   m.author.initials,
            'role':       m.author.role,
            'role_label': role_label(m.author.role),
        },
    }

def serialize_participant(p):
    return {
        'id':         p.id,
        'user':       serialize_user(p.user),
        'added_by':   serialize_user(p.added_by),
        'created_at': utc_iso(p.created_at),
    }

def serialize_dm(m):
    return {
        'id':         m.id,
        'conv_id':    m.conversation_id,
        'content':    m.content,
        'created_at': utc_iso(m.created_at),
        'author': {
            'id':         m.author.id,
            'username':   m.author.username,
            'initials':   m.author.initials,
            'role':       m.author.role,
            'role_label': role_label(m.author.role),
        },
    }

def serialize_conversation(conv, uid):
    members = ConversationMember.query.filter_by(conversation_id=conv.id).all()
    last    = (DirectMessage.query
               .filter_by(conversation_id=conv.id)
               .order_by(DirectMessage.created_at.desc())
               .first())
    return {
        'id':           conv.id,
        'members':      [serialize_user(m.user) for m in members],
        'last_message': serialize_dm(last) if last else None,
        'created_at':   utc_iso(conv.created_at),
    }

def log_activity(ticket_id, action):
    db.session.add(ActivityLog(ticket_id=ticket_id, user_id=current_user.id, action=action))

def create_notification(user_id, notif_type, ticket, message):
    """Queue a notification; flush to get ID. Caller must commit then call emit_notification."""
    notif = Notification(
        user_id   = user_id,
        ticket_id = ticket.id,
        type      = notif_type,
        message   = message,
    )
    db.session.add(notif)
    db.session.flush()
    log_activity(ticket.id, f'[Notification] {message}')
    return notif

def emit_notification(notif):
    """Push a committed notification to the recipient's socket room."""
    socketio.emit('notification', serialize_notification(notif), room=f'user_{notif.user_id}')

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            return jsonify({'error': 'Administrator access required'}), 403
        return f(*args, **kwargs)
    return decorated

def it_support_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role not in ('it_support', 'admin'):
            return jsonify({'error': 'IT Support access required'}), 403
        return f(*args, **kwargs)
    return decorated

def active_tickets():
    """Base query for tickets that are not soft-deleted and not archived."""
    return Ticket.query.filter_by(is_deleted=False, is_archived=False)


# ── Auth API ──────────────────────────────────────────────────────────────────

@app.route('/api/auth/me')
def auth_me():
    if not current_user.is_authenticated:
        return jsonify({'user': None}), 200
    return jsonify({'user': serialize_user(current_user, include_email=True)})

@app.route('/api/auth/login', methods=['POST'])
def login():
    if current_user.is_authenticated:
        return jsonify({'user': serialize_user(current_user, include_email=True)})
    data       = request.get_json() or {}
    identifier = data.get('identifier', '').strip()
    password   = data.get('password', '')
    remember   = bool(data.get('remember', False))

    user = User.query.filter(
        (User.email == identifier) | (User.username == identifier)
    ).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401
    if not user.is_active_user:
        return jsonify({'error': 'Your account has been deactivated'}), 403

    login_user(user, remember=remember)
    return jsonify({'user': serialize_user(user, include_email=True)})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data     = request.get_json() or {}
    username = data.get('username', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    confirm  = data.get('confirm_password', '')
    role_req = data.get('role', 'user')

    if not username or not email or not password:
        return jsonify({'error': 'All fields are required'}), 400
    if role_req not in ('user', 'it_support'):
        return jsonify({'error': 'Invalid role selected'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if password != confirm:
        return jsonify({'error': 'Passwords do not match'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    is_first = User.query.count() == 0
    user = User(username=username, email=email,
                role='admin' if is_first else role_req)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'Account created. Please log in.'}), 201

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out'})


# ── Dashboard API ─────────────────────────────────────────────────────────────

@app.route('/api/dashboard')
@login_required
def dashboard():
    q = active_tickets()
    stats = {
        'total':       q.count(),
        'open':        q.filter_by(status='Open').count(),
        'in_progress': q.filter_by(status='In Progress').count(),
        'resolved':    q.filter_by(status='Resolved').count(),
        'critical':    q.filter_by(priority='Critical').count(),
        'closed':      q.filter_by(status='Closed').count(),
        'my_open':     (active_tickets().filter_by(created_by_id=current_user.id)
                        .filter(Ticket.status.notin_(['Resolved', 'Closed'])).count()),
        'my_queue':    0,
        'unassigned':  0,
        'archived':    0,
    }
    if current_user.role in ('it_support', 'admin'):
        stats['my_queue']   = (active_tickets().filter_by(assigned_to_id=current_user.id)
                                .filter(Ticket.status.notin_(['Resolved', 'Closed'])).count())
        stats['unassigned'] = (active_tickets().filter_by(assigned_to_id=None)
                                .filter(Ticket.status.notin_(['Resolved', 'Closed'])).count())
    if current_user.role == 'admin':
        stats['archived'] = Ticket.query.filter_by(is_archived=True, is_deleted=False).count()

    recent = active_tickets().order_by(Ticket.created_at.desc()).limit(8).all()
    return jsonify({'stats': stats, 'recent_tickets': [serialize_ticket(t) for t in recent]})


# ── Tickets API ───────────────────────────────────────────────────────────────

@app.route('/api/tickets')
@login_required
def ticket_list():
    page       = request.args.get('page', 1, type=int)
    status_f   = request.args.get('status', '')
    priority_f = request.args.get('priority', '')
    category_f = request.args.get('category', '')
    search_q   = request.args.get('q', '').strip()

    query = active_tickets()
    if status_f:   query = query.filter_by(status=status_f)
    if priority_f: query = query.filter_by(priority=priority_f)
    if category_f: query = query.filter_by(category=category_f)
    if search_q:
        query = query.filter(
            Ticket.title.ilike(f'%{search_q}%') |
            Ticket.ticket_id.ilike(f'%{search_q}%') |
            Ticket.description.ilike(f'%{search_q}%')
        )
    pagination = query.order_by(Ticket.created_at.desc()).paginate(page=page, per_page=15, error_out=False)
    return paginate_response(pagination, 'tickets', serialize_ticket)

@app.route('/api/tickets/my')
@login_required
def my_tickets():
    page     = request.args.get('page', 1, type=int)
    status_f = request.args.get('status', '')
    query    = active_tickets().filter_by(created_by_id=current_user.id)
    if status_f: query = query.filter_by(status=status_f)
    pagination = query.order_by(Ticket.created_at.desc()).paginate(page=page, per_page=15, error_out=False)
    return paginate_response(pagination, 'tickets', serialize_ticket)

@app.route('/api/tickets', methods=['POST'])
@login_required
def create_ticket():
    data         = request.get_json() or {}
    title        = data.get('title', '').strip()
    description  = data.get('description', '').strip()
    priority     = data.get('priority', 'Medium')
    category     = data.get('category', 'General')
    created_by_id = current_user.id

    # Admin can create ticket on behalf of another user
    if current_user.role == 'admin':
        cb = data.get('created_by_id')
        cu = (data.get('created_by_username') or '').strip()

        if cb is not None and cb != '':
            u = User.query.filter_by(id=int(cb), is_active_user=True).first()
            if not u:
                return jsonify({'error': 'Invalid user for ticket creator'}), 400
            created_by_id = u.id
        elif cu:
            u = User.query.filter(
                User.is_active_user == True,
                User.username.ilike(cu)
            ).first()
            if not u:
                return jsonify({'error': 'User not found for ticket creator'}), 400
            created_by_id = u.id

    if not title or not description:
        return jsonify({'error': 'Title and description are required'}), 400

    # Only admin can set priority on create; others get Medium
    if current_user.role != 'admin':
        priority = 'Medium'

    ticket = Ticket(
        ticket_id      = generate_ticket_id(),
        title          = title,
        description    = description,
        priority       = priority,
        category       = category,
        created_by_id  = created_by_id,
        assigned_to_id = None,  # Assignment only via Edit, admin only
    )
    db.session.add(ticket)
    db.session.flush()
    log_activity(ticket.id, 'Ticket created')
    db.session.commit()
    return jsonify({'ticket': serialize_ticket(ticket)}), 201

@app.route('/api/tickets/<ticket_id>')
@login_required
def get_ticket(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    comments = [serialize_comment(c) for c in ticket.comments.order_by(Comment.created_at).all()]
    logs     = [serialize_log(l) for l in
                ActivityLog.query.filter_by(ticket_id=ticket.id)
                .order_by(ActivityLog.created_at.desc()).all()]
    return jsonify({'ticket': serialize_ticket(ticket), 'comments': comments, 'logs': logs})

@app.route('/api/tickets/<ticket_id>', methods=['PUT'])
@login_required
def update_ticket(ticket_id):
    ticket   = Ticket.query.filter_by(ticket_id=ticket_id).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Archived tickets are read-only and cannot be edited'}), 403
    can_edit = (current_user.id == ticket.created_by_id or
                current_user.role in ('it_support', 'admin'))
    if not can_edit:
        return jsonify({'error': 'Permission denied'}), 403

    data = request.get_json() or {}
    ticket.title       = data.get('title', ticket.title).strip()
    ticket.description = data.get('description', ticket.description).strip()
    ticket.category    = data.get('category', ticket.category)
    ticket.updated_at  = datetime.utcnow()

    # Priority: Admin only
    if current_user.role == 'admin':
        ticket.priority = data.get('priority', ticket.priority)

    notifs = []
    # Status: IT Support and Admin can change
    if current_user.role in ('it_support', 'admin'):
        new_status = data.get('status', ticket.status)
        if new_status != ticket.status:
            log_activity(ticket.id, f'Status changed from "{ticket.status}" to "{new_status}"')
            if new_status == 'Closed':
                ticket.is_archived = True
                log_activity(ticket.id, 'Ticket archived (closed)')
            elif ticket.status == 'Closed' and new_status != 'Closed':
                ticket.is_archived = False
                log_activity(ticket.id, 'Ticket unarchived (reopened)')
            if new_status == 'Resolved' and ticket.status != 'Resolved':
                for admin in User.query.filter_by(role='admin').all():
                    notifs.append(create_notification(
                        admin.id, 'resolved', ticket,
                        f'{current_user.username} resolved ticket {ticket.ticket_id} ("{ticket.title}").'
                    ))
            ticket.status = new_status

    # Assignment: Admin only; must set priority before assigning
    if current_user.role == 'admin':
        raw = data.get('assigned_to_id')
        assigned_id = int(raw) if raw and str(raw).strip() else None
        if assigned_id != ticket.assigned_to_id:
            if not (ticket.priority or '').strip():
                return jsonify({'error': 'Set a priority level before assigning personnel'}), 400
            name = (db.session.get(User, assigned_id).username if assigned_id else 'Unassigned')
            log_activity(ticket.id, f'Assigned to {name}')
            if assigned_id and assigned_id != current_user.id:
                notifs.append(create_notification(
                    assigned_id, 'assigned', ticket,
                    f'{current_user.username} assigned ticket {ticket.ticket_id} ("{ticket.title}") to you.'
                ))
            ticket.assigned_to_id = assigned_id

    db.session.commit()
    for n in notifs:
        emit_notification(n)
    return jsonify({'ticket': serialize_ticket(ticket)})

@app.route('/api/tickets/<ticket_id>', methods=['DELETE'])
@login_required
def delete_ticket(ticket_id):
    ticket   = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Archived tickets cannot be deleted. Restore the ticket first.'}), 403
    is_owner = current_user.id == ticket.created_by_id
    is_admin = current_user.role == 'admin'

    if not is_owner and not is_admin:
        return jsonify({'error': 'Permission denied'}), 403

    if is_owner and not is_admin:
        if ticket.status not in ('Open', 'In Progress'):
            return jsonify({
                'error': f'Cannot delete a ticket with status "{ticket.status}". '
                          'Only Open or In Progress tickets can be deleted.'
            }), 403

    ticket.is_deleted = True
    ticket.updated_at = datetime.utcnow()
    log_activity(ticket.id, f'Ticket soft-deleted by {current_user.username}')
    db.session.commit()
    return jsonify({'message': f'Ticket {ticket_id} deleted'})

@app.route('/api/tickets/<ticket_id>/comments', methods=['POST'])
@login_required
def add_comment(ticket_id):
    ticket  = Ticket.query.filter_by(ticket_id=ticket_id).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Archived tickets are read-only. No new comments allowed.'}), 403
    content = (request.get_json() or {}).get('content', '').strip()
    if not content:
        return jsonify({'error': 'Comment cannot be empty'}), 400
    comment = Comment(content=content, ticket_id=ticket.id, user_id=current_user.id)
    db.session.add(comment)
    ticket.updated_at = datetime.utcnow()
    log_activity(ticket.id, f'{current_user.username} added a comment')
    db.session.commit()
    comment_data = serialize_comment(comment)
    socketio.emit('new_comment', comment_data, room=f'ticket_{ticket_id}')
    return jsonify({'comment': comment_data}), 201

@app.route('/api/tickets/<ticket_id>/status', methods=['PATCH'])
@login_required
def update_status(ticket_id):
    ticket     = Ticket.query.filter_by(ticket_id=ticket_id).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Archived tickets are read-only. Status cannot be changed.'}), 403
    new_status = (request.get_json() or {}).get('status')
    can_update = (current_user.role in ('it_support', 'admin') or
                  current_user.id == ticket.created_by_id)
    if not can_update:
        return jsonify({'error': 'Forbidden'}), 403
    if new_status not in Ticket.STATUS_CHOICES:
        return jsonify({'error': 'Invalid status'}), 400
    old_status        = ticket.status
    ticket.status     = new_status
    ticket.updated_at = datetime.utcnow()
    log_activity(ticket.id, f'Status changed from "{old_status}" to "{new_status}"')
    if new_status == 'Closed' and old_status != 'Closed':
        ticket.is_archived = True
        log_activity(ticket.id, 'Ticket archived (closed)')
    elif old_status == 'Closed' and new_status != 'Closed':
        ticket.is_archived = False
        log_activity(ticket.id, 'Ticket unarchived (reopened)')
    notifs = []
    if new_status == 'Resolved' and old_status != 'Resolved':
        for admin in User.query.filter_by(role='admin').all():
            notifs.append(create_notification(
                admin.id, 'resolved', ticket,
                f'{current_user.username} resolved ticket {ticket.ticket_id} ("{ticket.title}").'
            ))
    db.session.commit()
    for n in notifs:
        emit_notification(n)
    return jsonify({'ticket': serialize_ticket(ticket)})

@app.route('/api/tickets/<ticket_id>/archive', methods=['POST'])
@login_required
@admin_required
def archive_ticket(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Ticket is already archived'}), 409
    if ticket.status not in ('Resolved', 'Closed'):
        return jsonify({'error': 'Only Resolved or Closed tickets can be manually archived'}), 403
    ticket.is_archived = True
    ticket.updated_at  = datetime.utcnow()
    log_activity(ticket.id, f'Ticket manually archived by {current_user.username}')
    db.session.commit()
    return jsonify({'ticket': serialize_ticket(ticket)})

@app.route('/api/tickets/<ticket_id>/restore', methods=['POST'])
@login_required
@admin_required
def restore_ticket(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if not ticket.is_archived:
        return jsonify({'error': 'Ticket is not archived'}), 409
    ticket.is_archived = False
    ticket.status      = 'Open'
    ticket.updated_at  = datetime.utcnow()
    log_activity(ticket.id, f'Ticket restored from archive by {current_user.username}')
    db.session.commit()
    return jsonify({'ticket': serialize_ticket(ticket)})

@app.route('/api/tickets/<ticket_id>/claim', methods=['POST'])
@login_required
@it_support_required
def claim_ticket(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id).first_or_404()
    if ticket.assigned_to_id:
        return jsonify({'error': 'Ticket is already assigned'}), 409
    ticket.assigned_to_id = current_user.id
    ticket.updated_at     = datetime.utcnow()
    if ticket.status == 'Open':
        ticket.status = 'In Progress'
    log_activity(ticket.id, f'Claimed by {current_user.username}')
    db.session.commit()
    return jsonify({'ticket': serialize_ticket(ticket)})


# ── IT Support API ────────────────────────────────────────────────────────────

@app.route('/api/it-support/queue')
@login_required
@it_support_required
def it_support_queue():
    page     = request.args.get('page', 1, type=int)
    status_f = request.args.get('status', '')
    query    = active_tickets().filter_by(assigned_to_id=current_user.id)
    if status_f: query = query.filter_by(status=status_f)
    pagination = query.order_by(Ticket.priority.desc(), Ticket.created_at.asc()).paginate(page=page, per_page=15, error_out=False)
    return paginate_response(pagination, 'tickets', serialize_ticket)

@app.route('/api/it-support/unassigned')
@login_required
@it_support_required
def unassigned_tickets():
    page       = request.args.get('page', 1, type=int)
    priority_f = request.args.get('priority', '')
    query      = active_tickets().filter_by(assigned_to_id=None).filter(
        Ticket.status.notin_(['Resolved', 'Closed'])
    )
    if priority_f: query = query.filter_by(priority=priority_f)
    pagination = query.order_by(Ticket.created_at.asc()).paginate(page=page, per_page=15, error_out=False)
    return paginate_response(pagination, 'tickets', serialize_ticket)


# ── Admin API ─────────────────────────────────────────────────────────────────

@app.route('/api/admin/users')
@login_required
@admin_required
def admin_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({'users': [
        {**serialize_user(u, include_email=True),
         'tickets_created_count': u.tickets_created.count()}
        for u in users
    ]})

@app.route('/api/admin/users/<int:user_id>/role', methods=['PATCH'])
@login_required
@admin_required
def change_role(user_id):
    user     = db.session.get(User, user_id)
    new_role = (request.get_json() or {}).get('role')
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if new_role not in ('user', 'it_support', 'admin'):
        return jsonify({'error': 'Invalid role'}), 400
    user.role = new_role
    db.session.commit()
    return jsonify({'user': serialize_user(user, include_email=True)})

@app.route('/api/admin/users/<int:user_id>/toggle', methods=['PATCH'])
@login_required
@admin_required
def toggle_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.id == current_user.id:
        return jsonify({'error': 'Cannot deactivate yourself'}), 400
    user.is_active_user = not user.is_active_user
    db.session.commit()
    return jsonify({'user': serialize_user(user, include_email=True)})

@app.route('/api/admin/users/<int:user_id>/reset-password', methods=['POST'])
@login_required
@admin_required
def admin_reset_password(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.id == current_user.id:
        return jsonify({'error': 'Use Account Settings to change your own password'}), 400
    DEFAULT_PASSWORD = '123456'
    user.set_password(DEFAULT_PASSWORD)
    db.session.commit()
    log_activity(current_user.id, 'admin_reset_password',
                 f"Admin reset password for user '{user.username}' (ID {user.id})")
    return jsonify({'message': f"Password for '{user.username}' has been reset to the default."})

@app.route('/api/admin/archive')
@login_required
@admin_required
def admin_archive():
    page       = request.args.get('page', 1, type=int)
    priority_f = request.args.get('priority', '')
    category_f = request.args.get('category', '')
    search_q   = request.args.get('q', '').strip()
    query = Ticket.query.filter_by(is_archived=True, is_deleted=False)
    if priority_f: query = query.filter_by(priority=priority_f)
    if category_f: query = query.filter_by(category=category_f)
    if search_q:
        query = query.filter(
            Ticket.title.ilike(f'%{search_q}%') |
            Ticket.ticket_id.ilike(f'%{search_q}%') |
            Ticket.description.ilike(f'%{search_q}%')
        )
    pagination = query.order_by(Ticket.updated_at.desc()).paginate(page=page, per_page=15, error_out=False)
    return paginate_response(pagination, 'tickets', serialize_ticket)


# ── Reports ──────────────────────────────────────────────────────────────────

PRIORITY_RANK  = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
STATUS_ORDER   = ['Open', 'In Progress', 'Under Review', 'Resolved', 'Closed']

@app.route('/api/reports/tickets')
@login_required
@admin_required
def get_ticket_report():
    period       = request.args.get('period', 'month')   # 'week' | 'month'
    month_filter = request.args.get('month', '').strip()  # 'YYYY-MM', optional

    # ── base query: all non-deleted tickets including archived ───────────────
    base_q = Ticket.query.filter(Ticket.is_deleted == False)

    # available months (from ALL tickets, used to populate the picker)
    all_tickets    = base_q.all()
    month_set      = sorted(
        {t.created_at.strftime('%Y-%m') for t in all_tickets},
        reverse=True
    )
    available_months = [
        {'value': m, 'label': datetime.strptime(m, '%Y-%m').strftime('%B %Y')}
        for m in month_set
    ]

    # ── apply optional month filter ───────────────────────────────────────────
    if month_filter:
        try:
            yr, mo = map(int, month_filter.split('-'))
            base_q = base_q.filter(
                db.extract('year',  Ticket.created_at) == yr,
                db.extract('month', Ticket.created_at) == mo,
            )
        except (ValueError, AttributeError):
            pass

    tickets = base_q.all()
    total   = len(tickets)

    # ── by status ─────────────────────────────────────────────────────────────
    by_stat = {}
    for t in tickets:
        by_stat[t.status] = by_stat.get(t.status, 0) + 1
    by_status = [
        {'status': s, 'count': by_stat[s]}
        for s in STATUS_ORDER if s in by_stat
    ]

    # ── by category ──────────────────────────────────────────────────────────
    by_cat = {}
    for t in tickets:
        by_cat[t.category] = by_cat.get(t.category, 0) + 1
    by_category = sorted(
        [{'category': k, 'count': v} for k, v in by_cat.items()],
        key=lambda x: -x['count']
    )

    # ── by priority ───────────────────────────────────────────────────────────
    by_pri = {}
    for t in tickets:
        by_pri[t.priority] = by_pri.get(t.priority, 0) + 1
    by_priority = sorted(
        [{'priority': k, 'count': v} for k, v in by_pri.items()],
        key=lambda x: PRIORITY_RANK.get(x['priority'], 99)
    )

    # ── by assigned personnel (resolved/closed only) ──────────────────────────
    by_pers = {}
    for t in tickets:
        if t.assignee and t.status in ('Resolved', 'Closed'):
            uid = t.assigned_to_id
            if uid not in by_pers:
                by_pers[uid] = {
                    'username':   t.assignee.username,
                    'role_label': role_label(t.assignee.role),
                    'count':      0,
                }
            by_pers[uid]['count'] += 1
    by_personnel = sorted(by_pers.values(), key=lambda x: -x['count'])

    # ── by period (week / month) based on created_at ──────────────────────────
    by_per = {}
    for t in tickets:
        ref = t.created_at
        if period == 'week':
            key   = ref.strftime('%Y-W%W')
            label = f"Wk {ref.strftime('%W')} · {ref.strftime('%Y')}"
        else:
            key   = ref.strftime('%Y-%m')
            label = ref.strftime('%b %Y')
        if key not in by_per:
            by_per[key] = {'key': key, 'label': label, 'count': 0}
        by_per[key]['count'] += 1
    by_period = sorted(by_per.values(), key=lambda x: x['key'])

    # ── flat ticket rows (for CSV export) ─────────────────────────────────────
    rows = []
    for t in sorted(tickets, key=lambda x: x.created_at, reverse=True):
        rows.append({
            'ticket_id':   t.ticket_id,
            'title':       t.title,
            'status':      t.status,
            'category':    t.category,
            'priority':    t.priority,
            'assigned_to': t.assignee.username if t.assignee else 'Unassigned',
            'created_by':  t.creator.username,
            'created_at':  utc_iso(t.created_at),
            'updated_at':  utc_iso(t.updated_at),
            'is_archived': t.is_archived,
        })

    return jsonify({
        'total':            total,
        'by_status':        by_status,
        'by_category':      by_category,
        'by_priority':      by_priority,
        'by_personnel':     by_personnel,
        'by_period':        by_period,
        'tickets':          rows,
        'available_months': available_months,
        'active_month':     month_filter or '',
    })

# keep old URL working as an alias
@app.route('/api/reports/resolved')
@login_required
@admin_required
def get_resolved_report():
    return get_ticket_report()


# ── Socket.IO Events ──────────────────────────────────────────────────────────

@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        join_room(f'user_{current_user.id}')

@socketio.on('disconnect')
def handle_disconnect():
    pass

@socketio.on('join_ticket')
def handle_join_ticket(data):
    if not current_user.is_authenticated:
        return
    ticket_id_str = data.get('ticket_id', '')
    if ticket_id_str:
        join_room(f'ticket_{ticket_id_str}')

@socketio.on('leave_ticket')
def handle_leave_ticket(data):
    if not current_user.is_authenticated:
        return
    ticket_id_str = data.get('ticket_id', '')
    if ticket_id_str:
        leave_room(f'ticket_{ticket_id_str}')

@socketio.on('join_conv')
def handle_join_conv(data):
    if not current_user.is_authenticated:
        return
    conv_id = data.get('conv_id')
    if not conv_id:
        return
    member = ConversationMember.query.filter_by(conversation_id=conv_id, user_id=current_user.id).first()
    if member:
        join_room(f'conv_{conv_id}')

@socketio.on('leave_conv')
def handle_leave_conv(data):
    if not current_user.is_authenticated:
        return
    conv_id = data.get('conv_id')
    if conv_id:
        leave_room(f'conv_{conv_id}')

@socketio.on('send_dm')
def handle_send_dm(data):
    if not current_user.is_authenticated:
        return
    conv_id = data.get('conv_id')
    content = (data.get('content') or '').strip()
    if not content or not conv_id:
        return
    member = ConversationMember.query.filter_by(conversation_id=conv_id, user_id=current_user.id).first()
    if not member:
        return
    msg = DirectMessage(conversation_id=conv_id, user_id=current_user.id, content=content)
    db.session.add(msg)
    db.session.commit()
    emit('dm_message', serialize_dm(msg), room=f'conv_{conv_id}')


def _can_chat(ticket, uid, role):
    """Return True if the user is allowed to read/send chat on this ticket."""
    if role in ('it_support', 'admin'):
        return True
    if uid in (ticket.created_by_id, ticket.assigned_to_id):
        return True
    return ChatParticipant.query.filter_by(ticket_id=ticket.id, user_id=uid).first() is not None


@socketio.on('send_chat')
def handle_send_chat(data):
    if not current_user.is_authenticated:
        return
    ticket_id_str = data.get('ticket_id', '')
    content       = (data.get('content') or '').strip()
    if not content or not ticket_id_str:
        return
    ticket = Ticket.query.filter_by(ticket_id=ticket_id_str, is_deleted=False).first()
    if not ticket or ticket.is_archived:
        return
    if not _can_chat(ticket, current_user.id, current_user.role):
        return
    msg = ChatMessage(ticket_id=ticket.id, user_id=current_user.id, content=content)
    db.session.add(msg)
    db.session.commit()
    emit('chat_message', serialize_chat_message(msg), room=f'ticket_{ticket_id_str}')


# ── Chat REST API ──────────────────────────────────────────────────────────────

@app.route('/api/tickets/<ticket_id>/chat')
@login_required
def get_chat(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if not _can_chat(ticket, current_user.id, current_user.role):
        return jsonify({'error': 'Forbidden'}), 403
    messages = (
        ChatMessage.query
        .filter_by(ticket_id=ticket.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(200)
        .all()
    )
    return jsonify({'messages': [serialize_chat_message(m) for m in messages]})


@app.route('/api/tickets/<ticket_id>/chat/participants')
@login_required
def get_chat_participants(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if not _can_chat(ticket, current_user.id, current_user.role):
        return jsonify({'error': 'Forbidden'}), 403
    participants = (
        ChatParticipant.query
        .filter_by(ticket_id=ticket.id)
        .order_by(ChatParticipant.created_at.asc())
        .all()
    )
    return jsonify({'participants': [serialize_participant(p) for p in participants]})


@app.route('/api/tickets/<ticket_id>/chat/participants', methods=['POST'])
@login_required
def add_chat_participant(ticket_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Ticket is archived'}), 400
    if not _can_chat(ticket, current_user.id, current_user.role):
        return jsonify({'error': 'Forbidden'}), 403
    data    = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    new_user = User.query.filter_by(id=user_id, is_active_user=True).first()
    if not new_user:
        return jsonify({'error': 'User not found'}), 404
    # Already has access natively
    if new_user.role in ('it_support', 'admin') or new_user.id in (ticket.created_by_id, ticket.assigned_to_id):
        return jsonify({'error': 'User already has access to this ticket chat'}), 409
    existing = ChatParticipant.query.filter_by(ticket_id=ticket.id, user_id=new_user.id).first()
    if existing:
        return jsonify({'error': 'User is already a participant'}), 409
    participant = ChatParticipant(
        ticket_id=ticket.id,
        user_id=new_user.id,
        added_by_id=current_user.id,
    )
    db.session.add(participant)
    # System message in chat
    system_msg = ChatMessage(
        ticket_id=ticket.id,
        user_id=current_user.id,
        content=f'{new_user.username} was added to this conversation by {current_user.username}.',
        is_system=True,
    )
    db.session.add(system_msg)
    db.session.commit()
    socketio.emit('chat_message',    serialize_chat_message(system_msg),  room=f'ticket_{ticket_id}')
    socketio.emit('participant_added', serialize_participant(participant), room=f'ticket_{ticket_id}')
    return jsonify({'participant': serialize_participant(participant)}), 201


@app.route('/api/tickets/<ticket_id>/chat/participants/<int:user_id>', methods=['DELETE'])
@login_required
def remove_chat_participant(ticket_id, user_id):
    ticket = Ticket.query.filter_by(ticket_id=ticket_id, is_deleted=False).first_or_404()
    if ticket.is_archived:
        return jsonify({'error': 'Ticket is archived'}), 400
    # Only admins or the user who added can remove
    participant = ChatParticipant.query.filter_by(ticket_id=ticket.id, user_id=user_id).first_or_404()
    if current_user.role != 'admin' and participant.added_by_id != current_user.id and current_user.id != user_id:
        return jsonify({'error': 'Forbidden'}), 403
    removed_user = participant.user
    db.session.delete(participant)
    system_msg = ChatMessage(
        ticket_id=ticket.id,
        user_id=current_user.id,
        content=f'{removed_user.username} was removed from this conversation by {current_user.username}.',
        is_system=True,
    )
    db.session.add(system_msg)
    db.session.commit()
    socketio.emit('chat_message',       serialize_chat_message(system_msg), room=f'ticket_{ticket_id}')
    socketio.emit('participant_removed', {'user_id': user_id},              room=f'ticket_{ticket_id}')
    return jsonify({'message': 'Participant removed'})

@app.route('/api/chat/recent')
@login_required
def get_recent_chats():
    """Return the most recent chat message per ticket, for tickets the user can access."""
    limit = request.args.get('limit', 20, type=int)
    if current_user.role in ('it_support', 'admin'):
        # All non-deleted tickets with at least one chat message
        ticket_ids = db.session.query(ChatMessage.ticket_id).distinct().subquery()
        tickets = (
            Ticket.query
            .filter(Ticket.id.in_(ticket_ids), Ticket.is_deleted == False)
            .all()
        )
    else:
        # Tickets created by / assigned to the user, plus tickets they are a participant in
        participant_ticket_ids = [
            p.ticket_id for p in
            ChatParticipant.query.filter_by(user_id=current_user.id).all()
        ]
        tickets = (
            Ticket.query
            .filter(
                Ticket.is_deleted == False,
                db.or_(
                    Ticket.created_by_id  == current_user.id,
                    Ticket.assigned_to_id == current_user.id,
                    Ticket.id.in_(participant_ticket_ids),
                )
            )
            .all()
        )

    results = []
    for ticket in tickets:
        last = (
            ChatMessage.query
            .filter_by(ticket_id=ticket.id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        if last:
            results.append({
                **serialize_chat_message(last),
                'ticket_id':    ticket.ticket_id,
                'ticket_title': ticket.title,
                'ticket_status': ticket.status,
            })

    results.sort(key=lambda r: r['created_at'], reverse=True)
    return jsonify({'chats': results[:limit]})


# ── Notification API ──────────────────────────────────────────────────────────

@app.route('/api/notifications')
@login_required
def list_notifications():
    limit = request.args.get('limit', 30, type=int)
    notifications = (
        Notification.query
        .filter_by(user_id=current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .all()
    )
    unread_count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({
        'notifications': [serialize_notification(n) for n in notifications],
        'unread_count':  unread_count,
    })

@app.route('/api/notifications/<int:notif_id>/read', methods=['PATCH'])
@login_required
def mark_notification_read(notif_id):
    notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first_or_404()
    notif.is_read = True
    db.session.commit()
    return jsonify({'notification': serialize_notification(notif)})

@app.route('/api/notifications/read-all', methods=['POST'])
@login_required
def mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'All notifications marked as read'})


# ── Profile API ───────────────────────────────────────────────────────────────

@app.route('/api/profile/info', methods=['PATCH'])
@login_required
def update_profile_info():
    data         = request.get_json() or {}
    new_username = data.get('username', '').strip()
    new_email    = data.get('email', '').strip().lower()
    if not new_username or not new_email:
        return jsonify({'error': 'Username and email are required'}), 400
    if (new_username != current_user.username and
            User.query.filter_by(username=new_username).first()):
        return jsonify({'error': 'Username already taken'}), 409
    if (new_email != current_user.email and
            User.query.filter_by(email=new_email).first()):
        return jsonify({'error': 'Email already in use'}), 409
    current_user.username = new_username
    current_user.email    = new_email
    db.session.commit()
    return jsonify({'user': serialize_user(current_user, include_email=True)})

@app.route('/api/profile/password', methods=['PATCH'])
@login_required
def change_password():
    data    = request.get_json() or {}
    old_pw  = data.get('old_password', '')
    new_pw  = data.get('new_password', '')
    confirm = data.get('confirm_password', '')
    if not current_user.check_password(old_pw):
        return jsonify({'error': 'Current password is incorrect'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400
    if new_pw != confirm:
        return jsonify({'error': 'Passwords do not match'}), 400
    current_user.set_password(new_pw)
    db.session.commit()
    return jsonify({'message': 'Password changed'})


# ── Messaging (Conversations) API ────────────────────────────────────────────

@app.route('/api/conversations')
@login_required
def list_conversations():
    memberships = ConversationMember.query.filter_by(user_id=current_user.id).all()
    conv_ids    = [m.conversation_id for m in memberships]
    convs       = Conversation.query.filter(Conversation.id.in_(conv_ids)).all()
    result      = [serialize_conversation(c, current_user.id) for c in convs]
    # Sort by last message time, newest first
    result.sort(key=lambda c: c['last_message']['created_at'] if c['last_message'] else c['created_at'], reverse=True)
    return jsonify({'conversations': result})


@app.route('/api/conversations', methods=['POST'])
@login_required
def create_conversation():
    data       = request.get_json() or {}
    member_ids = [int(i) for i in data.get('member_ids', [])]
    if not member_ids:
        return jsonify({'error': 'At least one other member is required'}), 400

    all_ids = list(set([current_user.id] + member_ids))

    # For 1-on-1: reuse existing conversation with exactly the same two members
    if len(all_ids) == 2:
        other_id     = [i for i in all_ids if i != current_user.id][0]
        my_ids       = {m.conversation_id for m in ConversationMember.query.filter_by(user_id=current_user.id).all()}
        their_ids    = {m.conversation_id for m in ConversationMember.query.filter_by(user_id=other_id).all()}
        shared       = my_ids & their_ids
        for cid in shared:
            if ConversationMember.query.filter_by(conversation_id=cid).count() == 2:
                conv = Conversation.query.get(cid)
                return jsonify({'conversation': serialize_conversation(conv, current_user.id)}), 200

    conv = Conversation(created_by_id=current_user.id)
    db.session.add(conv)
    db.session.flush()
    for uid in all_ids:
        u = User.query.filter_by(id=uid, is_active_user=True).first()
        if u:
            db.session.add(ConversationMember(conversation_id=conv.id, user_id=uid))
    db.session.commit()
    return jsonify({'conversation': serialize_conversation(conv, current_user.id)}), 201


@app.route('/api/conversations/<int:conv_id>/messages')
@login_required
def get_conv_messages(conv_id):
    member = ConversationMember.query.filter_by(conversation_id=conv_id, user_id=current_user.id).first()
    if not member:
        return jsonify({'error': 'Forbidden'}), 403
    msgs = (DirectMessage.query
            .filter_by(conversation_id=conv_id)
            .order_by(DirectMessage.created_at.asc())
            .limit(200).all())
    return jsonify({'messages': [serialize_dm(m) for m in msgs]})


@app.route('/api/conversations/<int:conv_id>/members', methods=['POST'])
@login_required
def add_conv_member(conv_id):
    member = ConversationMember.query.filter_by(conversation_id=conv_id, user_id=current_user.id).first()
    if not member:
        return jsonify({'error': 'Forbidden'}), 403
    data    = request.get_json() or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    new_user = User.query.filter_by(id=user_id, is_active_user=True).first()
    if not new_user:
        return jsonify({'error': 'User not found'}), 404
    if ConversationMember.query.filter_by(conversation_id=conv_id, user_id=user_id).first():
        return jsonify({'error': 'Already a member'}), 409
    db.session.add(ConversationMember(conversation_id=conv_id, user_id=user_id))
    db.session.commit()
    socketio.emit('member_added', {'conv_id': conv_id, 'user': serialize_user(new_user)}, room=f'conv_{conv_id}')
    return jsonify({'user': serialize_user(new_user)}), 201


# ── Utils API ─────────────────────────────────────────────────────────────────

@app.route('/api/utils/assignees')
@login_required
def get_assignees():
    users = User.query.filter(User.role.in_(['it_support', 'admin']),
                              User.is_active_user == True).all()
    return jsonify({'assignees': [serialize_user(u) for u in users]})


@app.route('/api/users/search')
@login_required
def search_users():
    """Search registered users by username — used for participant selection."""
    q           = (request.args.get('q') or '').strip()
    exclude_ids = request.args.getlist('exclude', type=int)
    # Always exclude the querying user
    exclude_ids.append(current_user.id)
    query = User.query.filter(
        User.is_active_user == True,
        User.id.notin_(exclude_ids),
    )
    if q:
        query = query.filter(User.username.ilike(f'%{q}%'))
    users = query.order_by(User.username.asc()).limit(10).all()
    return jsonify({'users': [serialize_user(u) for u in users]})

@app.route('/api/utils/choices')
def get_choices():
    return jsonify({
        'status_choices':   Ticket.STATUS_CHOICES,
        'priority_choices': Ticket.PRIORITY_CHOICES,
        'category_choices': Ticket.CATEGORY_CHOICES,
    })


# ── Init ──────────────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()
    # Safely add columns that may not exist on older databases.
    # PostgreSQL supports ADD COLUMN IF NOT EXISTS (v9.6+) so no try/except needed.
    migrations = [
        ('tickets',       'is_deleted',  'BOOLEAN NOT NULL DEFAULT FALSE'),
        ('tickets',       'is_archived', 'BOOLEAN NOT NULL DEFAULT FALSE'),
        ('chat_messages', 'is_system',   'BOOLEAN NOT NULL DEFAULT FALSE'),
    ]
    with db.engine.connect() as conn:
        for table, col, typedef in migrations:
            conn.execute(db.text(
                f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typedef}'
            ))
        conn.commit()

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)
