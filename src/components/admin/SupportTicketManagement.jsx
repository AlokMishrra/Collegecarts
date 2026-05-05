import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Ticket, 
  Search, 
  Filter, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  Package,
  Calendar,
  Send,
  Loader2,
  Gift
} from "lucide-react";

export default function SupportTicketManagement() {
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [ticketUsers, setTicketUsers] = useState({});

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchQuery, statusFilter, categoryFilter, priorityFilter]);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const allTickets = await base44.entities.SupportTicket.list('-created_date');
      
      // Load user details for each ticket
      const userIds = [...new Set(allTickets.map(t => t.user_id))];
      const users = {};
      
      for (const userId of userIds) {
        try {
          const userList = await base44.entities.User.filter({ id: userId });
          if (userList.length > 0) {
            users[userId] = userList[0];
          }
        } catch (error) {
          console.error(`Error loading user ${userId}:`, error);
        }
      }
      
      setTicketUsers(users);
      setTickets(allTickets);
    } catch (error) {
      console.error("Error loading tickets:", error);
    }
    setIsLoading(false);
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(ticket =>
        ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  };

  const loadTicketComments = async (ticketId) => {
    try {
      const ticketComments = await base44.entities.SupportTicketComment.filter({ ticket_id: ticketId }, '-created_date');
      
      // Load user details for comments
      const commentUsers = {};
      for (const comment of ticketComments) {
        if (!commentUsers[comment.user_id]) {
          try {
            const userList = await base44.entities.User.filter({ id: comment.user_id });
            if (userList.length > 0) {
              commentUsers[comment.user_id] = userList[0];
            }
          } catch (error) {
            console.error(`Error loading comment user ${comment.user_id}:`, error);
          }
        }
      }
      
      // Attach user info to comments
      const commentsWithUsers = ticketComments.map(comment => ({
        ...comment,
        user: commentUsers[comment.user_id]
      }));
      
      setComments(commentsWithUsers);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const handleTicketClick = async (ticket) => {
    setSelectedTicket(ticket);
    await loadTicketComments(ticket.id);
  };

  const handleUpdateStatus = async (ticketId, newStatus) => {
    try {
      await base44.entities.SupportTicket.update(ticketId, { status: newStatus });
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating ticket status:", error);
      alert("Error updating ticket status");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTicket) return;

    try {
      setIsSubmittingComment(true);
      const currentUser = await base44.auth.me();
      
      await base44.entities.SupportTicketComment.create({
        ticket_id: selectedTicket.id,
        user_id: currentUser.id,
        comment: newComment,
        is_internal: false
      });

      setNewComment('');
      await loadTicketComments(selectedTicket.id);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Error adding comment");
    }
    setIsSubmittingComment(false);
  };

  const getStatusBadge = (status) => {
    const variants = {
      open: { color: 'bg-blue-100 text-blue-800', icon: Clock },
      in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      resolved: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
      closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle }
    };
    const variant = variants[status] || variants.open;
    const Icon = variant.icon;
    
    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={colors[priority] || colors.medium}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getCategoryIcon = (category) => {
    const icons = {
      order: Package,
      product: Package,
      delivery: Package,
      payment: Mail,
      loyalty: Gift,
      general: MessageSquare
    };
    return icons[category] || MessageSquare;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
        <p className="text-gray-600">Manage customer support requests</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold">{tickets.length}</p>
              </div>
              <Ticket className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open</p>
                <p className="text-2xl font-bold text-blue-600">
                  {tickets.filter(t => t.status === 'open').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {tickets.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-2xl font-bold text-green-600">
                  {tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="loyalty">Loyalty</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets ({filteredTickets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredTickets.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No tickets found</p>
            ) : (
              filteredTickets.map(ticket => {
                const CategoryIcon = getCategoryIcon(ticket.category);
                const user = ticketUsers[ticket.user_id];
                
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleTicketClick(ticket)}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="font-semibold text-gray-900">{ticket.ticket_number}</p>
                          <p className="text-sm text-gray-600">{ticket.subject}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(ticket.priority)}
                        {getStatusBadge(ticket.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {user?.full_name || user?.email || 'Unknown User'}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(ticket.created_date).toLocaleDateString()}
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {ticket.category}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedTicket.ticket_number}</span>
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(selectedTicket.priority)}
                    {getStatusBadge(selectedTicket.status)}
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Ticket Info */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600">Subject</Label>
                    <p className="font-semibold">{selectedTicket.subject}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">Description</Label>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-gray-600">Category</Label>
                      <p className="capitalize">{selectedTicket.category}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-gray-600">Created</Label>
                      <p>{new Date(selectedTicket.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                  {selectedTicket.order_id && (
                    <div>
                      <Label className="text-sm text-gray-600">Related Order</Label>
                      <p>{selectedTicket.order_id}</p>
                    </div>
                  )}
                </div>

                {/* Status Update */}
                <div>
                  <Label>Update Status</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant={selectedTicket.status === 'open' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'open')}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTicket.status === 'in_progress' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'in_progress')}
                    >
                      In Progress
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTicket.status === 'resolved' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')}
                    >
                      Resolved
                    </Button>
                    <Button
                      size="sm"
                      variant={selectedTicket.status === 'closed' ? 'default' : 'outline'}
                      onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')}
                    >
                      Closed
                    </Button>
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <Label className="text-lg font-semibold">Comments ({comments.length})</Label>
                  <div className="space-y-3 mt-3 max-h-60 overflow-y-auto">
                    {comments.map(comment => (
                      <div key={comment.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-sm">
                              {comment.user?.full_name || comment.user?.email || 'Unknown'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_date).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Comment */}
                <div>
                  <Label>Add Comment</Label>
                  <div className="flex gap-2 mt-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type your response..."
                      rows={3}
                      className="flex-1"
                    />
                  </div>
                  <Button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="mt-2"
                  >
                    {isSubmittingComment ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Comment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
